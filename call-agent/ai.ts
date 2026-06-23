import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import { WebSocket } from 'ws';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Creates a real-time speech-to-speech bridge using Gemini Multimodal Live.
 * It manages the persistent WebSocket connection to Google's servers.
 */
export function createGeminiLiveSession(
  context: string,
  onAudioData: (base64Audio: string) => void,
  onTranscript: (role: 'model' | 'user', text: string) => void,
  onTurnComplete?: () => void,
  onInterrupted?: () => void,
  onToolCall?: (name: string, args: Record<string, unknown>, id: string) => void
) {
  const model = "gemini-3.1-flash-live-preview"; 
  
  // The Gemini Multimodal Live API uses a specialized WebSocket endpoint
  const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${process.env.GEMINI_API_KEY}`;
  
  const geminiWs = new WebSocket(url);
  let isSetupComplete = false;
  let audioBuffer: string[] = [];

  geminiWs.on('error', (err) => {
    console.error('Gemini WebSocket Error:', err.message);
  });

  geminiWs.on('open', () => {
    console.log('Connected to Gemini Multimodal Live API');
    
    // Send initial configuration with your system context
    const setupMessage = {
      setup: {
        model: `models/${model}`,
        generation_config: {
          response_modalities: ["AUDIO"],
          speech_config: {
            voice_config: { prebuilt_voice_config: { voice_name: "Zephyr" } }
          }
        },
        system_instruction: {
          parts: [{ text: context }]
        },
        tools: [{
          function_declarations: [
            {
              name: 'set_mode',
              description: "Call this once you've learned whether the recipient wants a brief summary or a detailed walkthrough.",
              parameters: {
                type: 'OBJECT',
                properties: { mode: { type: 'STRING', enum: ['summary', 'detail'] } },
                required: ['mode']
              }
            },
            {
              name: 'next_fact',
              description: 'Call this when you are ready to deliver the next single fact from the portfolio report to the recipient.',
              parameters: { type: 'OBJECT', properties: {} }
            }
          ]
        }],
        // Transcription fields (might still be unsupported in 3.1)
        output_audio_transcription: {},
        input_audio_transcription: {}
      }
    };

    console.log('Sending setup message:', JSON.stringify(setupMessage));
    geminiWs.send(JSON.stringify(setupMessage));
  });

  geminiWs.on('close', (code, reason) => {
    console.log(`Gemini WebSocket closed: ${code} ${reason}`);
  });

  let inboundCount = 0;
  geminiWs.on('message', (data) => {
    try {
      const response = JSON.parse(data.toString());
      
      if (response.setup_complete || response.setupComplete) {
        console.log('Gemini setup complete');
        isSetupComplete = true;
        // Flush buffered audio
        while (audioBuffer.length > 0) {
          const chunk = audioBuffer.shift();
          sendToGemini(chunk!);
        }
      }

      // Handle both snake_case and camelCase to be safe
      const serverContent = response.server_content || response.serverContent;
      
      // Handle transcription chunks
      const outputTranscription = serverContent?.output_transcription || serverContent?.outputTranscription;
      if (outputTranscription?.text) {
        onTranscript('model', outputTranscription.text);
      }

      const inputTranscription = serverContent?.input_transcription || serverContent?.inputTranscription;
      if (inputTranscription?.text) {
        console.log('User Transcript:', inputTranscription.text, 'Final:', inputTranscription.final || inputTranscription.isFinal);
        onTranscript('user', inputTranscription.text);
      } else if (serverContent?.client_content?.turn_complete === false) {
          // Fallback for some versions of the API that send interim text turns
          const text = serverContent.client_content.parts?.[0]?.text;
          if (text) onTranscript('user', text);
      }

      const modelTurn = serverContent?.model_turn || serverContent?.modelTurn;
      
      if (modelTurn?.parts) {
        for (const part of modelTurn.parts) {
          if (part.inline_data || part.inlineData) {
            inboundCount++;
            if (inboundCount % 50 === 0) {
              console.log(`Received 50 audio chunks from Gemini`);
            }
            const inlineData = part.inline_data || part.inlineData;
            const base64Pcm24k = inlineData.data;
            const pcm24k = Buffer.from(base64Pcm24k, 'base64');
            const pcm8k = downsample24kTo8k(pcm24k);
            const muLaw = pcmToMulaw(pcm8k);
            onAudioData(muLaw.toString('base64'));
          }
          // Note: We skip part.text here because we are using outputTranscription for live text
        }
      }
      
      if (serverContent?.interrupted) {
        console.log('Gemini interrupted');
        onInterrupted?.();
      }

      const turnComplete = serverContent?.turn_complete ?? serverContent?.turnComplete;
      if (turnComplete) {
        onTurnComplete?.();
      }

      const toolCall = response.tool_call ?? response.toolCall;
      const functionCalls = toolCall?.function_calls ?? toolCall?.functionCalls;
      if (Array.isArray(functionCalls)) {
        for (const fc of functionCalls) {
          console.log('Gemini tool call:', JSON.stringify(fc));
          onToolCall?.(fc.name, fc.args ?? {}, fc.id);
        }
      }
    } catch (err) {
      console.error('Error parsing Gemini message:', err);
      console.log('Raw message:', data.toString());
    }
  });

  function sendToGemini(base64Pcm16k: string) {
    geminiWs.send(JSON.stringify({
      realtime_input: {
        audio: {
          mime_type: "audio/pcm;rate=16000",
          data: base64Pcm16k
        }
      }
    }));
  }

  // Injects a text-only control turn (e.g. a silence nudge) so the model speaks
  // again without needing real user audio to trigger a turn.
  function sendSystemNote(text: string) {
    if (geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.send(JSON.stringify({
        client_content: {
          turns: [{ role: 'user', parts: [{ text }] }],
          turn_complete: true
        }
      }));
    }
  }

  // Resolves a pending function call so the model can continue past the tool gate.
  function sendToolResponse(id: string, response: Record<string, unknown>) {
    if (geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.send(JSON.stringify({
        tool_response: {
          function_responses: [{ id, response }]
        }
      }));
    }
  }

  let outboundCount = 0;
  return {
    // Pipe raw audio from Twilio directly into Gemini
    sendAudio: (base64MuLaw: string) => {
      if (geminiWs.readyState === WebSocket.OPEN) {
        const muLawBuffer = Buffer.from(base64MuLaw, 'base64');
        const pcm8kBuffer = mulawToPcm(muLawBuffer);
        const pcm16kBuffer = upsample8kTo16k(pcm8kBuffer);
        const base64Pcm16k = pcm16kBuffer.toString('base64');

        if (!isSetupComplete) {
          audioBuffer.push(base64Pcm16k);
          // Keep buffer manageable (last 5 seconds approx)
          if (audioBuffer.length > 250) audioBuffer.shift();
          return;
        }

        outboundCount++;
        if (outboundCount % 100 === 0) {
          console.log(`Sent 100 audio chunks to Gemini`);
        }
        sendToGemini(base64Pcm16k);
      }
    },
    sendSystemNote,
    sendToolResponse,
    close: () => geminiWs.close()
  };
}

// --- Audio Conversion Helpers ---

function upsample8kTo16k(pcm8k: Buffer): Buffer {
  const pcm16k = Buffer.alloc(pcm8k.length * 2);
  for (let i = 0; i < pcm8k.length / 2; i++) {
    const sample = pcm8k.readInt16LE(i * 2);
    pcm16k.writeInt16LE(sample, i * 4);
    pcm16k.writeInt16LE(sample, i * 4 + 2);
  }
  return pcm16k;
}

function mulawToPcm(mulaw: Buffer): Buffer {
  const pcm = Buffer.alloc(mulaw.length * 2);
  for (let i = 0; i < mulaw.length; i++) {
    const byte = ~mulaw[i] & 0xFF;
    const sign = byte & 0x80;
    const exponent = (byte & 0x70) >> 4;
    const mantissa = byte & 0x0F;
    let sample = (mantissa << 3) + 132;
    sample <<= exponent;
    sample -= 132;
    const finalSample = sign ? -sample : sample;
    pcm.writeInt16LE(finalSample, i * 2);
  }
  return pcm;
}

function pcmToMulaw(pcm: Buffer): Buffer {
  const samples = Math.floor(pcm.length / 2);
  const mulaw = Buffer.alloc(samples);
  for (let i = 0; i < samples; i++) {
    const sample = pcm.readInt16LE(i * 2);
    mulaw[i] = linearToMulaw(sample);
  }
  return mulaw;
}

function linearToMulaw(sample: number): number {
  const BIAS = 132;
  const CLIP = 32635;
  const sign = sample < 0 ? 0x80 : 0;
  if (sample < 0) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample += BIAS;
  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--) {
    expMask >>= 1;
  }
  const mantissa = (sample >> (exponent + 3)) & 0x0F;
  return ~(sign | (exponent << 4) | mantissa) & 0xFF;
}

function downsample24kTo8k(pcm24k: Buffer): Buffer {
  const samples24k = Math.floor(pcm24k.length / 2);
  const samples8k = Math.floor(samples24k / 3);
  const pcm8k = Buffer.alloc(samples8k * 2);
  for (let i = 0; i < samples8k; i++) {
    const sample = pcm24k.readInt16LE(i * 3 * 2);
    pcm8k.writeInt16LE(sample, i * 2);
  }
  return pcm8k;
}
