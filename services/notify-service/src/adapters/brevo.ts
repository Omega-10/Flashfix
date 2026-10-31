export interface BrevoConfig {
  apiKey: string;
  senderEmail: string;
  senderName: string;
}

export class BrevoEmailAdapter {
  private apiKey: string;
  private senderEmail: string;
  private senderName: string;

  constructor(config: BrevoConfig) {
    this.apiKey = config.apiKey;
    this.senderEmail = config.senderEmail || 'noreply@flashfix.in';
    this.senderName = config.senderName || 'Flashfix Support';
  }

  public async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
    templateType?: string;
  }): Promise<{ messageId: string; success: boolean }> {
    const payload = {
      sender: {
        name: this.senderName,
        email: this.senderEmail,
      },
      to: [{ email: params.to.trim().toLowerCase() }],
      subject: params.subject,
      htmlContent: params.html,
      textContent: params.text,
    };

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.apiKey,
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Brevo API Error (${res.status}): ${errBody}`);
    }

    const data = (await res.json()) as { messageId?: string };
    return {
      messageId: data.messageId || `brevo-${Date.now()}`,
      success: true,
    };
  }
}
