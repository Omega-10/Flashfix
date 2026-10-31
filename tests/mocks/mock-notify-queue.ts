/**
 * In-memory Mock Notification Queue for Brevo Transactional Email Adapter.
 * Allows hermetic testing of notifications, OTP delivery, and brand styling (#ef8f0b).
 */

export interface EnqueuedNotification {
  id: string;
  recipientEmail: string;
  templateType: 'otp-login' | 'booking-confirmed' | 'pickup-otp' | 'custody-otp' | 'repair-complete' | 'employee-assigned';
  subject: string;
  bodyHtml: string;
  variables: Record<string, any>;
  timestamp: Date;
}

export class MockNotificationQueue {
  private queue: EnqueuedNotification[] = [];

  /**
   * Enqueues a simulated transactional email notification.
   */
  public enqueue(
    recipientEmail: string,
    templateType: EnqueuedNotification['templateType'],
    variables: Record<string, any>,
    subjectOverride?: string
  ): EnqueuedNotification {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const subject = subjectOverride || this.generateSubject(templateType, variables);
    const bodyHtml = this.renderTemplate(templateType, variables);

    const notification: EnqueuedNotification = {
      id,
      recipientEmail: recipientEmail.trim().toLowerCase(),
      templateType,
      subject,
      bodyHtml,
      variables,
      timestamp: new Date()
    };

    this.queue.push(notification);
    return notification;
  }

  /**
   * Generates standard subject line for Flashfix transactional emails.
   */
  private generateSubject(type: EnqueuedNotification['templateType'], vars: Record<string, any>): string {
    switch (type) {
      case 'otp-login':
        return `Your Flashfix Login OTP: ${vars.code || ''}`;
      case 'booking-confirmed':
        return `Booking Confirmed: ${vars.bookingId || ''} - Flashfix Repair`;
      case 'pickup-otp':
        return `Flashfix Handover OTP: ${vars.code || ''} (Booking ${vars.bookingId || ''})`;
      case 'custody-otp':
        return `Flashfix Custody OTP: ${vars.code || ''} (Booking ${vars.bookingId || ''})`;
      case 'repair-complete':
        return `Your Repair is Complete! - Flashfix Booking ${vars.bookingId || ''}`;
      case 'employee-assigned':
        return `New Flashfix Job Assignment: Booking ${vars.bookingId || ''}`;
    }
  }

  /**
   * Simulates HTML email template rendering with Flashfix #ef8f0b branding.
   */
  private renderTemplate(type: EnqueuedNotification['templateType'], vars: Record<string, any>): string {
    const primaryColor = '#ef8f0b';
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .brand-header { background-color: ${primaryColor}; color: #ffffff; padding: 16px; font-family: sans-serif; }
            .otp-code { font-size: 28px; font-weight: bold; color: ${primaryColor}; letter-spacing: 4px; }
            .footer { font-size: 12px; color: #888888; margin-top: 24px; }
          </style>
        </head>
        <body>
          <div class="brand-header">
            <h2>⚡ FLASHFIX</h2>
          </div>
          <div class="content">
            <p>Notification Type: ${type}</p>
            ${vars.code ? `<p class="otp-code">${vars.code}</p>` : ''}
            ${vars.bookingId ? `<p>Booking ID: <strong>${vars.bookingId}</strong></p>` : ''}
            ${vars.trackingLink ? `<a href="${vars.trackingLink}" style="color: ${primaryColor}">Track Your Repair</a>` : ''}
          </div>
          <div class="footer">
            <p>Fast, reliable doorstep phone repair.</p>
          </div>
        </body>
      </html>
    `;
  }

  public getAll(): EnqueuedNotification[] {
    return [...this.queue];
  }

  public getByRecipient(recipientEmail: string): EnqueuedNotification[] {
    const normalized = recipientEmail.trim().toLowerCase();
    return this.queue.filter((n) => n.recipientEmail === normalized);
  }

  public getLatestOtp(recipientEmail: string, templateType?: EnqueuedNotification['templateType']): string | null {
    const list = this.getByRecipient(recipientEmail);
    const filtered = templateType ? list.filter((n) => n.templateType === templateType) : list;
    if (filtered.length === 0) return null;
    const latest = filtered[filtered.length - 1];
    return (latest.variables.code as string) || null;
  }

  public clear(): void {
    this.queue = [];
  }
}

export const mockNotificationQueue = new MockNotificationQueue();
