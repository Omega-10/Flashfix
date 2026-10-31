/**
 * Unified E2E Test Suite Runner for Flashfix Platform (Tiers 1-4).
 * Executes all hermetic test files across Feature Coverage, Boundary/Corner Cases,
 * Cross-Feature Combinations, and Real-World Scenarios.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

const TEST_FILES = [
  // Tier 1: Feature Coverage
  'tests/e2e/tier1-feature-coverage/auth-otp.test.ts',
  'tests/e2e/tier1-feature-coverage/disposable-email.test.ts',
  'tests/e2e/tier1-feature-coverage/booking-lifecycle.test.ts',
  'tests/e2e/tier1-feature-coverage/custody-otp.test.ts',
  'tests/e2e/tier1-feature-coverage/audit-trail.test.ts',
  'tests/e2e/tier1-feature-coverage/stores-distance.test.ts',
  'tests/e2e/tier1-feature-coverage/admin-stats.test.ts',
  'tests/e2e/tier1-feature-coverage/frontend-phase0.test.ts',

  // Tier 2: Boundary & Corner Cases
  'tests/e2e/tier2-boundary-corner/otp-boundaries.test.ts',
  'tests/e2e/tier2-boundary-corner/distance-boundaries.test.ts',
  'tests/e2e/tier2-boundary-corner/booking-transition-boundaries.test.ts',
  'tests/e2e/tier2-boundary-corner/disposable-email-boundaries.test.ts',
  'tests/e2e/tier2-boundary-corner/currency-paise-boundaries.test.ts',

  // Tier 3: Cross-Feature Combinations
  'tests/e2e/tier3-cross-feature/consumer-lifecycle-flow.test.ts',
  'tests/e2e/tier3-cross-feature/cross-service-notifications.test.ts',

  // Tier 4: Real-World Scenarios
  'tests/e2e/tier4-real-world/scenario-koramangala-flash.test.ts',
  'tests/e2e/tier4-real-world/scenario-whitefield-nextday.test.ts',
  'tests/e2e/tier4-real-world/scenario-blocked-spammer.test.ts',
  'tests/e2e/tier4-real-world/scenario-concurrent-bookings.test.ts'
];

console.log('======================================================================');
console.log('⚡ FLASHFIX DUAL-TRACK E2E TEST RUNNER (TIERS 1 - 4)');
console.log('======================================================================');
console.log(`Discovered ${TEST_FILES.length} test suite files covering all 56 platform features.`);
console.log('Mode: Hermetic (In-Memory DB, Brevo Mock Queue, Google OAuth Mock)');
console.log('----------------------------------------------------------------------\n');

const child = spawn(
  'npx',
  ['tsx', '--test', ...TEST_FILES],
  {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd()
  }
);

child.on('close', (code) => {
  console.log('\n----------------------------------------------------------------------');
  if (code === 0) {
    console.log('✅ ALL E2E TEST TIERS (1-4) PASSED CLEANLY (100% PASS RATE)');
    console.log('======================================================================');
  } else {
    console.error(`❌ E2E TEST SUITE FAILED WITH EXIT CODE: ${code}`);
    console.log('======================================================================');
  }
  process.exit(code ?? 1);
});
