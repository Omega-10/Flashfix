import test from 'node:test';
import assert from 'node:assert/strict';
import { isDisposableEmail } from '../../mocks/index.ts';

test.describe('Tier 2: Boundary & Corner Cases - Disposable Email Normalization & Edge Cases', () => {
  test('TC-BOUND-EMAIL-01: Detects and rejects nested subdomains under disposable domains', () => {
    const subdomains = [
      'user@alpha.mailinator.com',
      'user@dev.test.mailinator.com',
      'user@temp.sharklasers.com',
      'user@staging.guerrillamail.com',
      'user@sub.yopmail.com'
    ];

    for (const email of subdomains) {
      assert.equal(
        isDisposableEmail(email),
        true,
        `Expected ${email} to be detected as disposable subdomain`
      );
    }
  });

  test('TC-BOUND-EMAIL-02: Normalizes mixed-case and uppercase disposable emails accurately', () => {
    const mixedCaseEmails = [
      'TEST@MAILINATOR.COM',
      'SpAmMeR@TeMp-MaIl.OrG',
      'BoT@ShArKlAsErS.cOm',
      'HaCkEr@10MiNuTeMaIl.CoM'
    ];

    for (const email of mixedCaseEmails) {
      assert.equal(
        isDisposableEmail(email),
        true,
        `Expected ${email} to be detected regardless of case`
      );
    }
  });

  test('TC-BOUND-EMAIL-03: Trims surrounding whitespace before evaluating domain', () => {
    const spacedEmails = [
      '  user@mailinator.com  ',
      '\tuser@tempmail.com\n',
      '   burn@guerrillamail.com '
    ];

    for (const email of spacedEmails) {
      assert.equal(
        isDisposableEmail(email),
        true,
        `Expected trimmed ${email} to be detected as disposable`
      );
    }
  });

  test('TC-BOUND-EMAIL-04: Returns false for malformed or non-string inputs safely without crashing', () => {
    const malformed = [
      '',
      '   ',
      'notanemail',
      'user@',
      '@domain.com',
      'user@@domain.com',
      null as any,
      undefined as any,
      12345 as any
    ];

    for (const item of malformed) {
      assert.equal(isDisposableEmail(item), false);
    }
  });

  test('TC-BOUND-EMAIL-05: Avoids false positives on legitimate educational & corporate domains', () => {
    const legitDomains = [
      'student@temple.edu',
      'contact@mailchimp.com',
      'employee@postman.com',
      'user@mailbox.org',
      'researcher@iis.ac.in',
      'engineer@flashfix.in'
    ];

    for (const email of legitDomains) {
      assert.equal(
        isDisposableEmail(email),
        false,
        `Expected legitimate email ${email} to NOT be flagged as disposable`
      );
    }
  });
});
