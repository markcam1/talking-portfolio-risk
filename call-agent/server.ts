import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { parse } from 'url';
import { TwilioClient } from './twilio.js';
import { createGeminiLiveSession } from './ai.js';
import { talkingDispatchRouter, talkingMeta, hasOptOutPhrase, postTalkingWebhook } from './talking-dispatch.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(talkingDispatchRouter);

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const frontendWss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const { pathname } = parse(request.url!);
  if (pathname === '/stream') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (pathname === '/feedback') {
    frontendWss.handleUpgrade(request, socket, head, (ws) => {
      frontendWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

const broadcastToFrontend = (data: unknown) => {
  frontendWss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data));
    }
  });
};

(global as any).broadcastToFrontend = broadcastToFrontend;

frontendWss.on('connection', () => {
  console.log('[call-agent] frontend client connected');
});

const PORT = process.env.PORT || 3334;
const twilioClient = new TwilioClient(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const callContexts = new Map<string, string>();
const transcripts = new Map<string, { role: string; text: string }[]>();
(global as any).callContexts = callContexts;
(global as any).transcripts = transcripts;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/voice-webhook', (req, res) => {
  const publicUrl = process.env.PUBLIC_URL!;
  if (!publicUrl) {
    return res.status(500).send('Configuration error: PUBLIC_URL not set');
  }
  const streamUrl = publicUrl.replace('https://', 'wss://') + '/stream';
  res.type('text/xml');
  res.send(twilioClient.getStreamConnectXml(streamUrl));
});

// P10 scaffold — inbound calls (INBOUND_ENABLED=false by default)
if (process.env.INBOUND_ENABLED === 'true') {
  app.post('/incoming', (req, res) => {
    const publicUrl = process.env.PUBLIC_URL!;
    const streamUrl = publicUrl.replace('https://', 'wss://') + '/stream';
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`);
  });
}

wss.on('connection', (ws) => {
  console.log('[call-agent] Twilio media stream connected');
  let callSid: string | null = null;
  let streamSid: string | null = null;
  let geminiSession: any = null;
  let mediaCount = 0;

  ws.on('message', async (message) => {
    const data = JSON.parse(message.toString());

    switch (data.event) {
      case 'start':
        callSid = data.start.callSid;
        streamSid = data.start.streamSid;
        console.log(`[call-agent] stream started callSid=${callSid}`);

        broadcastToFrontend({ event: 'status', callSid, status: 'started' });

        const context = callContexts.get(callSid!) || 'You are a helpful assistant.';

        geminiSession = createGeminiLiveSession(
          context,
          (base64Audio) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                event: 'media',
                streamSid,
                media: { payload: base64Audio },
              }));
            }
          },
          (role, text) => {
            const transcript = transcripts.get(callSid!) || [];
            transcript.push({ role, text });
            transcripts.set(callSid!, transcript);

            broadcastToFrontend({ event: 'transcript', callSid, role, text });

            const tMeta = talkingMeta.get(callSid!);
            if (tMeta) {
              postTalkingWebhook(tMeta.status_webhook, {
                event: 'transcript',
                call_id: tMeta.call_id,
                role,
                text,
              });
              if (role === 'user' && hasOptOutPhrase(text)) {
                postTalkingWebhook(tMeta.status_webhook, {
                  event: 'opt_out',
                  call_id: tMeta.call_id,
                });
              }
            }
          }
        );
        break;

      case 'media':
        mediaCount++;
        if (mediaCount % 100 === 0) {
          console.log(`[call-agent] ${mediaCount} media chunks received for ${callSid}`);
        }
        if (geminiSession) geminiSession.sendAudio(data.media.payload);
        break;

      case 'stop':
        console.log(`[call-agent] stream stopped callSid=${callSid}`);
        broadcastToFrontend({ event: 'status', callSid, status: 'stopped' });
        if (geminiSession) geminiSession.close();
        break;
    }
  });

  ws.on('close', () => {
    if (geminiSession) geminiSession.close();
  });
});

server.listen(PORT, () => {
  console.log(`[call-agent] server running on port ${PORT}`);
});
