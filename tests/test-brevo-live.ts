/**
 * tests/test-brevo-live.ts
 *
 * Verifies live Brevo API connectivity and SMTP email dispatch.
 * CRITICAL: Never logs or prints raw API keys (specifically Brevo secret keys).
 */

import { resolveBrevoConfig } from '../packages/web/api/_brevo';

function maskKey(key: string): string {
  if (!key) return '[EMPTY]';
  if (key.length <= 12) return '***';
  return `${key.slice(0, 6)}...${key.slice(-4)} (length: ${key.length})`;
}

async function runLiveBrevoVerification() {
  console.log('======================================================================');
  console.log('⚡ BREVO LIVE API CONNECTIVITY & DISPATCH VERIFICATION');
  console.log('======================================================================');

  const config = resolveBrevoConfig();

  console.log(`[Config] Resolved source: ${config.source}`);
  console.log(`[Config] Masked API key: ${maskKey(config.apiKey)}`);
  console.log(`[Config] Sender: ${config.senderName} <${config.senderEmail}>`);

  if (!config.apiKey) {
    throw new Error('FAIL: No Brevo API key could be resolved (env vars and fallback missing).');
  }

  // 1. Verify Brevo Account API Connectivity
  console.log('\n--- STEP 1: VERIFY BREVO ACCOUNT CONNECTIVITY (GET /v3/account) ---');
  const accountRes = await fetch('https://api.brevo.com/v3/account', {
    method: 'GET',
    headers: {
      'api-key': config.apiKey,
      Accept: 'application/json',
    },
  });

  if (!accountRes.ok) {
    const errText = await accountRes.text();
    console.error(`[FAIL] Brevo Account check failed: HTTP ${accountRes.status} - ${errText}`);
    throw new Error(`Brevo Account API error: HTTP ${accountRes.status}`);
  }

  const accountData = (await accountRes.json()) as any;
  console.log(`[PASS] Account verified successfully!`);
  console.log(`[Account] Email: ${accountData.email}`);
  console.log(`[Account] Company: ${accountData.companyName}`);
  console.log(`[Account] Plan: ${JSON.stringify(accountData.plan?.map((p: any) => ({ type: p.type, credits: p.credits })))}`);

  // 2. Verify Live Transactional Email Dispatch (POST /v3/smtp/email)
  console.log('\n--- STEP 2: VERIFY LIVE TRANSACTIONAL EMAIL DISPATCH ---');
  const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const testRecipient = config.senderEmail || 'nexusprojects03@gmail.com';

  const dispatchRes = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: config.senderName, email: config.senderEmail },
      to: [{ email: testRecipient }],
      subject: `⚡ Flashfix Milestone 4 Live Delivery Verification - OTP: ${testOtp}`,
      htmlContent: `
        <div style="font-family: sans-serif; background: #0D0D0D; color: #F5F0EB; padding: 24px; border-radius: 12px;">
          <h2 style="color: #ef8f0b;">⚡ Flashfix Live Verification</h2>
          <p>Live Brevo email delivery confirmed during Milestone 4 verification.</p>
          <p>Verification Code: <strong>${testOtp}</strong></p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        </div>
      `,
      textContent: `Flashfix Live Verification. OTP: ${testOtp}. Timestamp: ${new Date().toISOString()}`,
    }),
  });

  if (!dispatchRes.ok) {
    const errText = await dispatchRes.text();
    console.error(`[FAIL] Brevo SMTP email dispatch failed: HTTP ${dispatchRes.status} - ${errText}`);
    throw new Error(`Brevo SMTP dispatch error: HTTP ${dispatchRes.status}`);
  }

  const dispatchData = (await dispatchRes.json()) as any;
  console.log(`[PASS] Live transactional email dispatched successfully!`);
  console.log(`[Dispatch] MessageId: ${dispatchData.messageId}`);

  console.log('\n======================================================================');
  console.log('✅ LIVE BREVO VERIFICATION COMPLETE: ALL CHECKS PASSED');
  console.log('======================================================================');
}

runLiveBrevoVerification().catch((err) => {
  console.error('Brevo live verification error:', err.message);
  process.exit(1);
});
