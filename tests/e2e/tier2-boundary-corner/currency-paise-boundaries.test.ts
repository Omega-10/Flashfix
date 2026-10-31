import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mockDb,
  DomainLogicService
} from '../../mocks/index.ts';

test.describe('Tier 2: Boundary & Corner Cases - Currency Representation in Integer Paise', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    service = new DomainLogicService(mockDb);
  });

  test('TC-BOUND-PAISE-01: Accepts 0 paise for free diagnostic / warranty inspections', () => {
    const res = service.validatePaiseAmount(0);
    assert.equal(res.valid, true);

    const booking = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 15',
      issue: 'Diagnostics',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Free Diag',
      contactEmail: 'free@gmail.com',
      contactPhone: '+91 99999 00000',
      estimatedCostPaise: 0
    });
    assert.equal(booking.estimatedCostPaise, 0);
  });

  test('TC-BOUND-PAISE-02: Accepts standard positive integer paise amounts (e.g. 1850000 paise = ₹18,500.00)', () => {
    const validAmounts = [100, 50000, 1850000, 4500000, 99999900];

    for (const amt of validAmounts) {
      const res = service.validatePaiseAmount(amt);
      assert.equal(res.valid, true, `Amount ${amt} paise should be valid`);
    }
  });

  test('TC-BOUND-PAISE-03: Rejects negative paise amounts with clear validation error', () => {
    const negativeAmounts = [-1, -100, -50000, -1850000];

    for (const amt of negativeAmounts) {
      const res = service.validatePaiseAmount(amt);
      assert.equal(res.valid, false);
      assert.match(res.error || '', /cannot be negative/);

      assert.throws(
        () =>
          service.createBooking({
            brand: 'Apple',
            deviceModel: 'iPhone 15',
            issue: 'Screen',
            storeId: 'store-blr-01',
            scheduledDate: '2026-11-02',
            scheduledTime: '10:00 AM',
            contactName: 'Negative Cost',
            contactEmail: 'neg@gmail.com',
            contactPhone: '+91 99999 00000',
            estimatedCostPaise: amt
          }),
        /INVALID_COST.*cannot be negative/
      );
    }
  });

  test('TC-BOUND-PAISE-04: Rejects fractional paise amounts (must be integer cents/paise)', () => {
    const fractions = [10.5, 99.99, 18500.25, 0.1];

    for (const frac of fractions) {
      const res = service.validatePaiseAmount(frac);
      assert.equal(res.valid, false);
      assert.match(res.error || '', /must be an integer/);
    }
  });

  test('TC-BOUND-PAISE-05: Rejects non-numeric, null, undefined, or NaN types safely', () => {
    const invalidTypes = ['18500', null, undefined, NaN, {}, []];

    for (const item of invalidTypes) {
      const res = service.validatePaiseAmount(item);
      assert.equal(res.valid, false);
      assert.match(res.error || '', /must be a number/);
    }
  });

  test('TC-BOUND-PAISE-06: Enforces upper platform threshold limit (100,000,000 paise = ₹1,000,000.00)', () => {
    const maxPermitted = 100_000_000;
    const overLimit = 100_000_001;

    const resValid = service.validatePaiseAmount(maxPermitted);
    assert.equal(resValid.valid, true);

    const resOver = service.validatePaiseAmount(overLimit);
    assert.equal(resOver.valid, false);
    assert.match(resOver.error || '', /exceeds maximum permitted platform threshold/);
  });
});
