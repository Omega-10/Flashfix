import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Web catch-all handler
import webCatchallHandler from '../api/[...route].ts';

// Root catch-all handler at repository root
const rootCatchallFilePath = path.resolve(fileURLToPath(import.meta.url), '../../../../api/[...route].ts');
let rootCatchallHandler: any = null;
try {
  const mod = await import(pathToFileURL(rootCatchallFilePath).href);
  rootCatchallHandler = mod.default || mod;
} catch (e) {
  console.error('Failed to import rootCatchallHandler:', e);
}

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

describe('Empirical Adversarial Challenge: Milestone 3 Two-Factor Custody & Vercel Parity', () => {

  // =========================================================================
  // Dimension 1: Vercel Serverless Function Parity (api/ vs packages/web/api/)
  // =========================================================================
  describe('Dimension 1: Vercel Serverless Function Parity & Custody Route Mirroring', () => {
    const webFile = path.resolve(fileURLToPath(import.meta.url), '../../api/[...route].ts');
    const rootFile = rootCatchallFilePath;

    test('PARITY VERIFICATION: Root api/[...route].ts and packages/web/api/[...route].ts must be identical', () => {
      assert.ok(fs.existsSync(webFile), `File must exist: ${webFile}`);
      assert.ok(fs.existsSync(rootFile), `File must exist: ${rootFile}`);

      const webContent = fs.readFileSync(webFile, 'utf8');
      const rootContent = fs.readFileSync(rootFile, 'utf8');

      assert.strictEqual(
        rootContent,
        webContent,
        `PARITY VIOLATION: root api/[...route].ts (${rootContent.length} bytes, 415 lines) is missing custody routes present in packages/web/api/[...route].ts (${webContent.length} bytes, 1594 lines)`
      );
    });

    test('EMPIRICAL: Root handler must handle POST /api/bookings/:id/start-pickup and NOT return default gateway stub', async () => {
      assert.ok(rootCatchallHandler, 'Root catchall handler must be exportable and callable');
      const req = {
        method: 'POST',
        url: 'http://localhost/api/bookings/FF-104921/start-pickup',
      };
      const res = createMockRes();

      await rootCatchallHandler(req, res);

      assert.notStrictEqual(
        res.body?.service,
        'flashfix-vercel-gateway',
        'FAILURE: Root handler fell through to default stub! Custody routes are completely missing from root api/[...route].ts'
      );
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.data?.status, 'PICKUP_EN_ROUTE');
    });

    test('EMPIRICAL: Root handler must support POST /api/bookings/:id/send-pickup-otp', async () => {
      const req = {
        method: 'POST',
        url: 'http://localhost/api/bookings/FF-104921/send-pickup-otp',
      };
      const res = createMockRes();

      await rootCatchallHandler(req, res);

      assert.notStrictEqual(
        res.body?.service,
        'flashfix-vercel-gateway',
        'FAILURE: Root handler returned default stub for send-pickup-otp'
      );
      assert.strictEqual(res.statusCode, 200, 'Root handler must return 200 for send-pickup-otp');
      assert.ok(res.body?.otp, 'Root handler must generate and return 6-digit pickup OTP');
    });
  });

  // =========================================================================
  // Dimension 2: End-to-End Custody Lifecycle State Machine & Adversarial Attacks
  // =========================================================================
  describe('Dimension 2: End-to-End Custody Lifecycle & Security Invariants', () => {
    const bookingId = 'FF-104918'; // Pre-seeded CONFIRMED booking

    // Step A: CONFIRMED -> PICKUP_EN_ROUTE
    test('State Step 2 -> 3: POST /api/bookings/:id/start-pickup transitions CONFIRMED to PICKUP_EN_ROUTE', async () => {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${bookingId}/start-pickup`,
      };
      const res = createMockRes();
      await webCatchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.data?.status, 'PICKUP_EN_ROUTE');
    });

    // Step B: PICKUP_EN_ROUTE -> PICKUP_OTP_SENT
    let pickupOtp = '';
    test('State Step 3 -> 3 (OTP Pending): POST /api/bookings/:id/send-pickup-otp dispatches OTP', async () => {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${bookingId}/send-pickup-otp`,
      };
      const res = createMockRes();
      await webCatchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.data?.status, 'PICKUP_OTP_SENT');
      assert.ok(res.body?.otp);
      assert.match(res.body?.otp, /^\d{6}$/);
      pickupOtp = res.body.otp;
    });

    // Attack 1: Incorrect OTP rejected
    test('SECURITY ATTACK: Invalid OTP must be rejected with 400', async () => {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${bookingId}/verify-pickup`,
        body: { otp: '000000' },
      };
      const res = createMockRes();
      await webCatchallHandler(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body?.success, false);
    });

    // Attack 2: Cross-booking OTP attack
    test('SECURITY ATTACK: Cross-booking OTP injection must fail', async () => {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/FF-104910/verify-pickup`,
        body: { otp: pickupOtp },
      };
      const res = createMockRes();
      await webCatchallHandler(req, res);

      assert.strictEqual(res.statusCode, 400);
    });

    // Step C: Verify Pickup OTP -> IN_TRANSIT
    test('State Step 3 -> 4: POST /api/bookings/:id/verify-pickup transitions to IN_TRANSIT', async () => {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${bookingId}/verify-pickup`,
        body: { otp: pickupOtp },
      };
      const res = createMockRes();
      await webCatchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.data?.status, 'IN_TRANSIT');
    });

    // Attack 3: OTP Replay Attack after consumption
    test('SECURITY CHALLENGE: Replaying consumed pickup OTP should be rejected (tests OTP invalidation)', async () => {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${bookingId}/verify-pickup`,
        body: { otp: pickupOtp },
      };
      const res = createMockRes();
      await webCatchallHandler(req, res);

      // If booking.pickupOtp is not cleared after verification, this returns 200 instead of 400!
      const isReplayVulnerable = res.statusCode === 200;
      if (isReplayVulnerable) {
        console.warn(`[VULNERABILITY CONFIRMED] verify-pickup allowed replay of consumed OTP code "${pickupOtp}". booking.pickupOtp was not cleared upon verification!`);
      }
      assert.strictEqual(
        res.statusCode,
        400,
        `VULNERABILITY: Consumed pickup OTP "${pickupOtp}" was accepted a second time! booking.pickupOtp must be invalidated upon successful verification.`
      );
    });

    // Step D: IN_TRANSIT -> CUSTODY_OTP_SENT
    let custodyOtp = '';
    test('State Step 4 -> 5: POST /api/bookings/:id/send-custody-otp transitions to CUSTODY_OTP_SENT', async () => {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${bookingId}/send-custody-otp`,
      };
      const res = createMockRes();
      await webCatchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.data?.status, 'CUSTODY_OTP_SENT');
      assert.ok(res.body?.otp);
      assert.match(res.body?.otp, /^\d{6}$/);
      custodyOtp = res.body.otp;
    });

    // Attack 4: Cross-purpose attack
    test('SECURITY ATTACK: Cross-purpose attack (using pickup OTP for custody verification) must fail', async () => {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${bookingId}/verify-custody`,
        body: { otp: '849201' },
      };
      const res = createMockRes();
      await webCatchallHandler(req, res);

      assert.strictEqual(res.statusCode, 400);
    });

    // Step E: Verify Custody OTP -> IN_REPAIR
    test('State Step 5 -> 6: POST /api/bookings/:id/verify-custody transitions to IN_REPAIR', async () => {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${bookingId}/verify-custody`,
        body: { otp: custodyOtp },
      };
      const res = createMockRes();
      await webCatchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.data?.status, 'IN_REPAIR');
    });

    // Step F: IN_REPAIR -> REPAIR_COMPLETE
    test('State Step 6 -> 7: POST /api/bookings/:id/repair-complete marks repair finished', async () => {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${bookingId}/repair-complete`,
        body: { finalCostPaise: 399900, note: 'Diagnostic passed and battery swapped' },
      };
      const res = createMockRes();
      await webCatchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.data?.status, 'REPAIR_COMPLETE');
      assert.strictEqual(res.body?.data?.finalCostPaise, 399900);
    });

    // Step G: REPAIR_COMPLETE -> RETURN_EN_ROUTE
    test('State Step 7 -> 8: PATCH /api/bookings/:id/status transitions to RETURN_EN_ROUTE', async () => {
      const req = {
        method: 'PATCH',
        url: `http://localhost/api/bookings/${bookingId}/status`,
        body: { status: 'RETURN_EN_ROUTE', note: 'Courier out for return delivery' },
      };
      const res = createMockRes();
      await webCatchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.data?.status, 'RETURN_EN_ROUTE');
    });

    // Step H: RETURN_EN_ROUTE -> DELIVERED
    test('State Step 8 -> 9: PATCH /api/bookings/:id/status transitions to DELIVERED and marks PAID', async () => {
      const req = {
        method: 'PATCH',
        url: `http://localhost/api/bookings/${bookingId}/status`,
        body: { status: 'DELIVERED', note: 'Customer accepted delivery and paid' },
      };
      const res = createMockRes();
      await webCatchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.data?.status, 'DELIVERED');
      assert.strictEqual(res.body?.data?.paymentStatus, 'PAID');
    });

    // Audit Trail Integrity Check
    test('AUDIT TRAIL: GET /api/bookings/:id/trail verifies chronological ordering and step coverage', async () => {
      const req = {
        method: 'GET',
        url: `http://localhost/api/bookings/${bookingId}/trail`,
      };
      const res = createMockRes();
      await webCatchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      const trail = res.body?.data;
      assert.ok(Array.isArray(trail));
      assert.ok(trail.length >= 6);

      // Verify strictly chronological timestamps
      for (let i = 0; i < trail.length - 1; i++) {
        const t1 = new Date(trail[i].createdAt).getTime();
        const t2 = new Date(trail[i + 1].createdAt).getTime();
        assert.ok(t1 <= t2, `Audit trail not chronological: item ${i} (${t1}) > item ${i+1} (${t2})`);
      }

      const toStatuses = trail.map((t: any) => t.toStatus);
      assert.ok(toStatuses.includes('PICKUP_EN_ROUTE'));
      assert.ok(toStatuses.includes('PICKUP_OTP_SENT'));
      assert.ok(toStatuses.includes('IN_TRANSIT'));
      assert.ok(toStatuses.includes('CUSTODY_OTP_SENT'));
      assert.ok(toStatuses.includes('IN_REPAIR'));
      assert.ok(toStatuses.includes('REPAIR_COMPLETE'));
      assert.ok(toStatuses.includes('RETURN_EN_ROUTE'));
      assert.ok(toStatuses.includes('DELIVERED'));
    });
  });

  // =========================================================================
  // Dimension 3: Consumer UI (TrackRepair.tsx) Timeline & Security Invariants
  // =========================================================================
  describe('Dimension 3: Consumer UI TrackRepair.tsx Timeline & State Mapping', () => {
    const trackRepairFile = path.resolve(
      fileURLToPath(import.meta.url),
      '../../src/pages/flashfix/TrackRepair.tsx'
    );
    const content = fs.readFileSync(trackRepairFile, 'utf8');

    test('STATIC: TrackRepair.tsx maps all 10 booking statuses correctly to 9-step timeline', () => {
      // Extract mapStatusToStepIndex implementation
      const match = content.match(/function mapStatusToStepIndex\([\s\S]*?\n\}/);
      assert.ok(match, 'mapStatusToStepIndex function must exist in TrackRepair.tsx');

      const fnCode = match[0];
      assert.ok(fnCode.includes('"PENDING":\n      return 1;'));
      assert.ok(fnCode.includes('"CONFIRMED":\n      return 2;'));
      assert.ok(fnCode.includes('"PICKUP_EN_ROUTE":'));
      assert.ok(fnCode.includes('"PICKUP_OTP_SENT":\n      return 3;'));
      assert.ok(fnCode.includes('"IN_TRANSIT":\n      return 4;'));
      assert.ok(fnCode.includes('"CUSTODY_OTP_SENT":\n      return 5;'));
      assert.ok(fnCode.includes('"IN_REPAIR":\n      return 6;'));
      assert.ok(fnCode.includes('"REPAIR_COMPLETE":\n      return 7;'));
      assert.ok(fnCode.includes('"RETURN_EN_ROUTE":\n      return 8;'));
      assert.ok(fnCode.includes('"DELIVERED":\n      return 9;'));
    });

    test('SECURITY: Doorstep PIN display card is conditioned ONLY on PICKUP_OTP_SENT', () => {
      assert.ok(
        content.includes('booking.status === "PICKUP_OTP_SENT"'),
        'PIN card must be conditioned on PICKUP_OTP_SENT'
      );
      assert.ok(
        content.includes('Doorstep Custody Handover Code'),
        'Must display Doorstep Custody Handover Code label'
      );
    });

    test('SECURITY: TrackRepair.tsx NEVER displays internal custodyOtp to consumer', () => {
      // Must not render custodyOtp anywhere in JSX
      assert.ok(
        !content.includes('{booking.custodyOtp}'),
        'Consumer view must NEVER expose internal lab custodyOtp'
      );
      assert.ok(
        !content.includes('booking.custodyOtp ||'),
        'Consumer view must NEVER render fallback custodyOtp'
      );
    });

    test('CHRONOLOGY: Audit trail events are explicitly sorted chronologically on data load', () => {
      assert.ok(
        content.includes('a.createdAt').valueOf() || content.includes('getTime()'),
        'Audit trail must be sorted by createdAt timestamp'
      );
    });
  });
});
