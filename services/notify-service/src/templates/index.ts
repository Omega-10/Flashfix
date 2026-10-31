export interface NotificationTemplateResult {
  subject: string;
  html: string;
  text: string;
}

const BRAND_ORANGE = '#ef8f0b';

function wrapLayout(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ededed; }
    .container { max-width: 600px; margin: 40px auto; background-color: #171717; border-radius: 12px; border: 1px solid #262626; overflow: hidden; }
    .header { background-color: #0a0a0a; padding: 24px 32px; border-bottom: 2px solid ${BRAND_ORANGE}; text-align: left; }
    .logo { color: ${BRAND_ORANGE}; font-size: 22px; font-weight: 800; letter-spacing: 1px; text-decoration: none; }
    .content { padding: 32px; font-size: 15px; line-height: 1.6; color: #d4d4d4; }
    .code-box { background-color: #262626; border: 1px dashed ${BRAND_ORANGE}; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
    .code { font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; color: ${BRAND_ORANGE}; letter-spacing: 6px; }
    .btn { display: inline-block; background-color: ${BRAND_ORANGE}; color: #0a0a0a; text-decoration: none; font-weight: 700; padding: 12px 24px; border-radius: 6px; margin: 20px 0; }
    .footer { padding: 24px 32px; background-color: #121212; border-top: 1px solid #262626; font-size: 12px; color: #737373; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="logo">⚡ FLASHFIX</span>
    </div>
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      <p>Flashfix Doorstep Phone Repair • Quick, secure, certified genuine repairs</p>
      <p>© ${new Date().getFullYear()} Flashfix Inc. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

export function renderOtpLoginTemplate(code: string): NotificationTemplateResult {
  const subject = `Your Flashfix Login OTP: ${code}`;
  const html = wrapLayout(
    'Flashfix Login OTP',
    `<h2 style="color: #ffffff; margin-top: 0;">Sign in to Flashfix</h2>
     <p>Use the 6-digit verification code below to complete your sign in. This code is valid for <strong>10 minutes</strong>.</p>
     <div class="code-box">
       <div class="code">${code}</div>
     </div>
     <p style="font-size: 13px; color: #a3a3a3;">If you did not request this login code, you can safely ignore this email.</p>`
  );
  const text = `Flashfix Login OTP: ${code}. Valid for 10 minutes.`;
  return { subject, html, text };
}

export function renderBookingConfirmedTemplate(params: {
  bookingId: string;
  customerName: string;
  deviceModel: string;
  scheduledDate: string;
  scheduledTime: string;
  storeName: string;
}): NotificationTemplateResult {
  const subject = `Booking Confirmed: ${params.bookingId} - Flashfix Repair`;
  const trackingUrl = `https://flashfix.in/flashfix/track/${params.bookingId}`;
  const html = wrapLayout(
    'Booking Confirmed',
    `<h2 style="color: #ffffff; margin-top: 0;">Repair Booking Confirmed!</h2>
     <p>Hello ${params.customerName},</p>
     <p>Your repair booking for <strong>${params.deviceModel}</strong> has been received and confirmed.</p>
     <div style="background-color: #262626; border-radius: 8px; padding: 20px; margin: 20px 0;">
       <p style="margin: 4px 0;"><strong>Booking ID:</strong> <span style="color: ${BRAND_ORANGE}">${params.bookingId}</span></p>
       <p style="margin: 4px 0;"><strong>Device:</strong> ${params.deviceModel}</p>
       <p style="margin: 4px 0;"><strong>Scheduled Slot:</strong> ${params.scheduledDate} at ${params.scheduledTime}</p>
       <p style="margin: 4px 0;"><strong>Assigned Service Hub:</strong> ${params.storeName}</p>
     </div>
     <div style="text-align: center;">
       <a href="${trackingUrl}" class="btn">Track Your Repair Live</a>
     </div>
     <p style="font-size: 13px; color: #a3a3a3;">Our delivery partner will reach your location at the scheduled time.</p>`
  );
  const text = `Booking Confirmed: ${params.bookingId}. Device: ${params.deviceModel}. Slot: ${params.scheduledDate} at ${params.scheduledTime}. Track: ${trackingUrl}`;
  return { subject, html, text };
}

export function renderPickupOtpTemplate(params: {
  code: string;
  bookingId: string;
  employeeName: string;
}): NotificationTemplateResult {
  const subject = `Flashfix Handover OTP: ${params.code} (Booking ${params.bookingId})`;
  const html = wrapLayout(
    'Doorstep Pickup OTP',
    `<h2 style="color: #ffffff; margin-top: 0;">Device Pickup Handover</h2>
     <p>Your Flashfix delivery partner <strong>${params.employeeName}</strong> has arrived to collect your device for booking <strong>${params.bookingId}</strong>.</p>
     <p>Please inspect the partner's badge and share the handover code below <strong>only after handing over the device</strong>:</p>
     <div class="code-box">
       <div class="code">${params.code}</div>
     </div>
     <p style="font-size: 13px; color: #a3a3a3;">This code confirms custody transfer of your device.</p>`
  );
  const text = `Flashfix Handover OTP for Booking ${params.bookingId}: ${params.code}. Share with ${params.employeeName} upon device pickup.`;
  return { subject, html, text };
}

export function renderCustodyOtpTemplate(params: {
  code: string;
  bookingId: string;
  technicianName: string;
}): NotificationTemplateResult {
  const subject = `Flashfix Custody OTP: ${params.code} (Booking ${params.bookingId})`;
  const html = wrapLayout(
    'Service Hub Custody OTP',
    `<h2 style="color: #ffffff; margin-top: 0;">Technician Custody Transfer</h2>
     <p>Device for booking <strong>${params.bookingId}</strong> has arrived at the service hub.</p>
     <p>Technician <strong>${params.technicianName}</strong>, verify custody transfer using this verification code:</p>
     <div class="code-box">
       <div class="code">${params.code}</div>
     </div>`
  );
  const text = `Flashfix Custody OTP for Booking ${params.bookingId}: ${params.code}. Verify to start repair.`;
  return { subject, html, text };
}

export function renderRepairCompleteTemplate(params: {
  bookingId: string;
  customerName: string;
  deviceModel: string;
}): NotificationTemplateResult {
  const subject = `Your Repair is Complete! - Flashfix Booking ${params.bookingId}`;
  const trackingUrl = `https://flashfix.in/flashfix/track/${params.bookingId}`;
  const html = wrapLayout(
    'Repair Complete',
    `<h2 style="color: #ffffff; margin-top: 0;">Device Repaired & Ready!</h2>
     <p>Hello ${params.customerName},</p>
     <p>Great news! The repair for your <strong>${params.deviceModel}</strong> (Booking ${params.bookingId}) is successfully completed and has passed our multi-point quality check.</p>
     <div style="text-align: center;">
       <a href="${trackingUrl}" class="btn">View Return Delivery Status</a>
     </div>`
  );
  const text = `Your Flashfix repair for ${params.deviceModel} (Booking ${params.bookingId}) is complete! Track: ${trackingUrl}`;
  return { subject, html, text };
}

export function renderEmployeeAssignedTemplate(params: {
  bookingId: string;
  customerName: string;
  pickupAddress: string;
  scheduledDate: string;
  scheduledTime: string;
}): NotificationTemplateResult {
  const subject = `New Flashfix Job Assignment: Booking ${params.bookingId}`;
  const html = wrapLayout(
    'New Job Assignment',
    `<h2 style="color: #ffffff; margin-top: 0;">New Job Assigned</h2>
     <p>You have been assigned to handle booking <strong>${params.bookingId}</strong>.</p>
     <div style="background-color: #262626; border-radius: 8px; padding: 20px; margin: 20px 0;">
       <p style="margin: 4px 0;"><strong>Customer:</strong> ${params.customerName}</p>
       <p style="margin: 4px 0;"><strong>Scheduled Time:</strong> ${params.scheduledDate} at ${params.scheduledTime}</p>
       <p style="margin: 4px 0;"><strong>Pickup Address:</strong> ${params.pickupAddress}</p>
     </div>`
  );
  const text = `New Flashfix Job: Booking ${params.bookingId}. Customer: ${params.customerName}. Pickup: ${params.pickupAddress}. Slot: ${params.scheduledDate} at ${params.scheduledTime}.`;
  return { subject, html, text };
}
