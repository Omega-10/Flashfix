export interface SentEmailRecord {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  templateType: string;
  metadata?: Record<string, any>;
  sentAt: Date;
}

export class ConsoleMockEmailAdapter {
  private inbox: SentEmailRecord[] = [];

  public async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
    templateType: string;
    metadata?: Record<string, any>;
  }): Promise<{ messageId: string; success: boolean }> {
    const id = `mock-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const record: SentEmailRecord = {
      id,
      to: params.to.trim().toLowerCase(),
      subject: params.subject,
      html: params.html,
      text: params.text,
      templateType: params.templateType,
      metadata: params.metadata,
      sentAt: new Date(),
    };

    this.inbox.push(record);

    if (process.env.NODE_ENV !== 'test') {
      console.log(`\n📧 [MOCK EMAIL DISPATCHED] ID: ${id}`);
      console.log(`   To: ${record.to}`);
      console.log(`   Subject: ${record.subject}`);
      console.log(`   Type: ${record.templateType}\n`);
    }

    return { messageId: id, success: true };
  }

  public getInbox(): SentEmailRecord[] {
    return [...this.inbox];
  }

  public getByRecipient(email: string): SentEmailRecord[] {
    const target = email.trim().toLowerCase();
    return this.inbox.filter((msg) => msg.to === target);
  }

  public clear(): void {
    this.inbox = [];
  }
}

export const consoleMockEmailAdapter = new ConsoleMockEmailAdapter();
