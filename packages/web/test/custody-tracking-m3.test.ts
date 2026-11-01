import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import catchallHandler from '../api/[...route].ts';

interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  setHeader: (k: string, v: string) => void;
  status: (code: number) => MockRes;
  json: (data: any) => MockRes;
  end: () => MockRes;
}

function createMockRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k: string, v: string) {
      this.headers[k.toLowerCase()] = v;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

describe('Milestone 3: Complete Two-Factor Custody Tracking & Vercel Serverless Endpoints (R3)', () => {
  const testBookingId = 'FF-104921';

  // -------------------------------------------------------------------------
  // 1. Vercel Serverless Custody State Machine Workflow
  // -------------------------------------------------------------------------
  describe('Vercel Serverless Custody Route Handlers', () => {
    test('POST /api/bookings/:id/start-pickup transitions status to PICKUP_EN_ROUTE and logs trail', async () => {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${testBookingId}/start-pickup`,
      };
      const res = createMockRes();

      await catchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.data?.status, 'PICKUP_EN_ROUTE');
    });

    let generatedPickupOtp = '';

    test('POST /api/bookings/:id/send-pickup-otp dispatches 6-digit OTP and transitions to PICKUP_OTP_SENT', async () => {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${testBookingId}/send-pickup-otp`,
      };
      const res = createMockRes();

      await catchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.data?.status, 'PICKUP_OTP_SENT');
      assert.ok(res.body?.otp, 'OTP code must be returned in serverless environment');
      assert.strictEqual(res.body?.otp.length, 6);
      assert.ok(/^\d{6}$/.test(res.body?.otp), 'OTP must be 6 numeric digits');
      generatedPickupOtp = res.body.otp;
    });

    test('POST /api/bookings/:id/verify-pickup rejects invalid OTP with 400', async () => {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${testBookingId}/verify-pickup`,
        body: { otp: '000000' },
      };
      const res = createMockRes();

      await catchallHandler(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body?.success, false);
      assert.ok(res.body?.error?.message?.includes('Invalid'));
    });

    test('POST /api/bookings/:id/verify-pickup verifies genuine OTP and transitions to IN_TRANSIT', async () => {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${testBookingId}/verify-pickup`,
        body: { otp: generatedPickupOtp },
      };
      const res = createMockRes();

      await catchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.data?.status, 'IN_TRANSIT');
    });

    let generatedCustodyOtp = '';

    test('POST /api/bookings/:id/send-custody-otp dispatches lab handover OTP and transitions to CUSTODY_OTP_SENT', async () => {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${testBookingId}/send-custody-otp`,
      };
      const res = createMockRes();

      await catchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.data?.status, 'CUSTODY_OTP_SENT');
      assert.ok(res.body?.otp);
      assert.strictEqual(res.body?.otp.length, 6);
      generatedCustodyOtp = res.body.otp;
    });

    test('POST /api/bookings/:id/verify-custody rejects invalid OTP with 400', async () => {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${testBookingId}/verify-custody`,
        body: { otp: '999999' },
      };
      const res = createMockRes();

      await catchallHandler(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body?.success, false);
    });

    test('POST /api/bookings/:id/verify-custody verifies genuine OTP and transitions to IN_REPAIR', async () => {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${testBookingId}/verify-custody`,
        body: { otp: generatedCustodyOtp },
      };
      const res = createMockRes();

      await catchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.data?.status, 'IN_REPAIR');
    });

    test('POST /api/bookings/:id/repair-complete marks repair finished with final cost', async () => {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${testBookingId}/repair-complete`,
        body: { finalCostPaise: 899900, note: 'OEM Grade-A OLED panel replaced and calibrated' },
      };
      const res = createMockRes();

      await catchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.data?.status, 'REPAIR_COMPLETE');
      assert.strictEqual(res.body?.data?.finalCostPaise, 899900);
    });

    test('GET /api/bookings/:id/trail returns chronological immutable audit trail', async () => {
      const req = {
        method: 'GET',
        url: `http://localhost/api/bookings/${testBookingId}/trail`,
      };
      const res = createMockRes();

      await catchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      const trail = res.body?.data;
      assert.ok(Array.isArray(trail));
      assert.ok(trail.length >= 5, 'Trail must contain all sequential state transitions');

      const statuses = trail.map((t: any) => t.toStatus);
      assert.ok(statuses.includes('PICKUP_EN_ROUTE'));
      assert.ok(statuses.includes('PICKUP_OTP_SENT'));
      assert.ok(statuses.includes('IN_TRANSIT'));
      assert.ok(statuses.includes('CUSTODY_OTP_SENT'));
      assert.ok(statuses.includes('IN_REPAIR'));
      assert.ok(statuses.includes('REPAIR_COMPLETE'));
    });

    test('GET /api/bookings/:id returns single booking enriched with personnel and trackingCode', async () => {
      const req = {
        method: 'GET',
        url: `http://localhost/api/bookings/${testBookingId}`,
      };
      const res = createMockRes();

      await catchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.data?.id, testBookingId);
      assert.strictEqual(res.body?.data?.brand, 'Apple');
      assert.strictEqual(res.body?.data?.deviceModel, 'iPhone 16 Pro Max');
      assert.strictEqual(res.body?.data?.status, 'REPAIR_COMPLETE');
    });

    test('PATCH /api/bookings/:id/status transitions to DELIVERED and marks paymentStatus PAID', async () => {
      const req = {
        method: 'PATCH',
        url: `http://localhost/api/bookings/${testBookingId}/status`,
        body: { status: 'DELIVERED', note: 'Customer accepted handover and paid via UPI QR' },
      };
      const res = createMockRes();

      await catchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.data?.status, 'DELIVERED');
      assert.strictEqual(res.body?.data?.paymentStatus, 'PAID');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Database Schema Alignment & Monorepo Mirroring Verification
  // -------------------------------------------------------------------------
  describe('Database Schema & Root API Mirroring', () => {
    function findRepoRoot(): string {
      let dir = process.cwd();
      for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(dir, 'packages', 'web')) && fs.existsSync(path.join(dir, 'api'))) {
          return dir;
        }
        dir = path.dirname(dir);
      }
      return process.cwd();
    }

    function resolveFromRoot(relPath: string): string {
      return path.join(findRepoRoot(), relPath);
    }

    test('packages/web/api/[...route].ts and api/[...route].ts are 100% synchronized', () => {
      const repoRoot = findRepoRoot();
      const webApiPath = path.join(repoRoot, 'packages', 'web', 'api', '[...route].ts');
      const rootApiPath = path.join(repoRoot, 'api', '[...route].ts');

      assert.notStrictEqual(webApiPath, rootApiPath, 'Test must compare distinct files, not the same file against itself');
      assert.ok(fs.existsSync(webApiPath), `Web API file must exist at ${webApiPath}`);
      assert.ok(fs.existsSync(rootApiPath), `Root API file must exist at ${rootApiPath}`);

      const webApiContent = fs.readFileSync(webApiPath, 'utf-8');
      const rootApiContent = fs.readFileSync(rootApiPath, 'utf-8');

      assert.strictEqual(
        rootApiContent,
        webApiContent,
        'Root api/[...route].ts must be an exact mirror of packages/web/api/[...route].ts'
      );
    });

    test('Raw SQL queries in [...route].ts match PostgreSQL schema exactly', () => {
      const webApiPath = resolveFromRoot('packages/web/api/[...route].ts');
      const content = fs.readFileSync(webApiPath, 'utf-8');

      // Schema column checks
      assert.ok(content.includes('code_hash'), 'Must use code_hash column in otp_codes queries');
      assert.ok(content.includes('verified = false'), 'Must check verified = false instead of legacy used = false');
      assert.ok(content.includes('verified = true'), 'Must update verified = true instead of used = true');
      assert.ok(content.includes("'LOGIN'"), "Must use uppercase enum 'LOGIN'");
      assert.ok(content.includes("'PICKUP'"), "Must use uppercase enum 'PICKUP'");
      assert.ok(content.includes("'CUSTODY'"), "Must use uppercase enum 'CUSTODY'");
      assert.ok(content.includes('issue_type'), 'Must use issue_type in bookings table queries');
      assert.ok(content.includes('tracking_code'), 'Must include tracking_code in bookings table queries');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Frontend Component Two-Factor Workflow Static Verification
  // -------------------------------------------------------------------------
  describe('Frontend Two-Factor Custody UI Workflows', () => {
    function findRepoRoot(): string {
      let dir = process.cwd();
      for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(dir, 'packages', 'web')) && fs.existsSync(path.join(dir, 'api'))) {
          return dir;
        }
        dir = path.dirname(dir);
      }
      return process.cwd();
    }

    function resolveFromRoot(relPath: string): string {
      return path.join(findRepoRoot(), relPath);
    }

    test('DeliveryPersonView.tsx contains full doorstep pickup and hub custody handover workflows', () => {
      const filePath = resolveFromRoot('packages/web/src/components/admin/DeliveryPersonView.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Doorstep pickup workflow
      assert.ok(content.includes('handleStartPickup'), 'Must implement handleStartPickup');
      assert.ok(content.includes('handleSendPickupOtp'), 'Must implement handleSendPickupOtp');
      assert.ok(content.includes('onOpenOtpModal'), 'Must trigger OTP verification modal');
      assert.ok(content.includes('purpose: "PICKUP"'), 'Must trigger modal with PICKUP purpose');

      // Hub custody handover workflow
      assert.ok(content.includes('handleHandoverAtHub'), 'Must implement handleHandoverAtHub');
      assert.ok(content.includes('sendCustodyOtp'), 'Must call sendCustodyOtp');
      assert.ok(content.includes('CUSTODY_OTP_SENT'), 'Must handle CUSTODY_OTP_SENT state');
    });

    test('TechnicianView.tsx contains custody receipt and repair completion workflows', () => {
      const filePath = resolveFromRoot('packages/web/src/components/admin/TechnicianView.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Custody receipt
      assert.ok(content.includes('purpose: "CUSTODY"'), 'Must trigger modal with CUSTODY purpose');
      assert.ok(content.includes('CUSTODY_OTP_SENT'), 'Must filter and render incoming custody bookings');

      // Repair completion
      assert.ok(content.includes('handleMarkComplete'), 'Must implement handleMarkComplete');
      assert.ok(content.includes('markRepairComplete'), 'Must invoke markRepairComplete API');
    });

    test('TrackRepair.tsx displays prominent Doorstep OTP code card when status is PICKUP_OTP_SENT', () => {
      const filePath = resolveFromRoot('packages/web/src/pages/flashfix/TrackRepair.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      assert.ok(content.includes('booking.status === "PICKUP_OTP_SENT"'), 'Must render active banner when PICKUP_OTP_SENT');
      assert.ok(content.includes('Doorstep Custody Handover Code') || content.includes('Doorstep Handover Security Code'), 'Must render doorstep handover header');
      assert.ok(content.includes('pickupOtp'), 'Must access and display pickupOtp code');
      assert.ok(content.includes('NINE_STEPS'), 'Must maintain 9-step timeline stepper');
      assert.ok(content.includes('Cryptographic Custody Audit Trail') || content.includes('Cryptographic Audit Log'), 'Must render audit trail section');
    });
  });
});
