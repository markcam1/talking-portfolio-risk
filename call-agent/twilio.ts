import twilio from 'twilio';

export class TwilioClient {
  private client: twilio.Twilio;

  constructor(accountSid: string, authToken: string) {
    this.client = twilio(accountSid, authToken);
  }

  async initiateCall(to: string, from: string, webhookUrl: string, statusCallbackUrl?: string) {
    return this.client.calls.create({
      to,
      from,
      url: webhookUrl,
      statusCallback: statusCallbackUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'busy', 'no-answer', 'failed', 'canceled'],
      statusCallbackMethod: 'POST',
      machineDetection: 'Enable'
    });
  }

  getStreamConnectXml(streamUrl: string) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`;
  }
}
