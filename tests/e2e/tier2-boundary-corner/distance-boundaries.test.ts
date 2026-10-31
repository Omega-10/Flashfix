import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHaversineDistanceKm,
  calculateStoreTier
} from '../../mocks/index.ts';

test.describe('Tier 2: Boundary & Corner Cases - Distance & Flash Tier Boundaries', () => {
  test('TC-BOUND-DIST-01: Threshold at 3.00km vs 3.01km distinguishes Flash vs Next-Day', () => {
    const atThreshold = calculateStoreTier(3.0);
    assert.equal(atThreshold.tier, 'flash');
    assert.equal(atThreshold.isFlashHero, true);
    assert.equal(atThreshold.estimatedPickupMinutes, 20);

    const pastThreshold = calculateStoreTier(3.01);
    assert.equal(pastThreshold.tier, 'next-day');
    assert.equal(pastThreshold.isFlashHero, false);
    assert.equal(pastThreshold.estimatedPickupMinutes, 1440);
  });

  test('TC-BOUND-DIST-02: Threshold at 10.00km vs 10.01km distinguishes Next-Day vs Out-Of-Range', () => {
    const atTenKm = calculateStoreTier(10.0);
    assert.equal(atTenKm.tier, 'next-day');
    assert.equal(atTenKm.isFlashHero, false);
    assert.equal(atTenKm.estimatedPickupMinutes, 1440);

    const pastTenKm = calculateStoreTier(10.01);
    assert.equal(pastTenKm.tier, 'out-of-range');
    assert.equal(pastTenKm.isFlashHero, false);
    assert.equal(pastTenKm.estimatedPickupMinutes, null);
  });

  test('TC-BOUND-DIST-03: Zero distance (0.00km) when user is located at exact store coordinates', () => {
    const lat = 12.9352;
    const lng = 77.6245;

    const dist = calculateHaversineDistanceKm(lat, lng, lat, lng);
    assert.equal(dist, 0);

    const tier = calculateStoreTier(dist);
    assert.equal(tier.tier, 'flash');
    assert.equal(tier.isFlashHero, true);
    assert.equal(tier.estimatedPickupMinutes, 20);
  });

  test('TC-BOUND-DIST-04: Sub-millimeter floating precision rounds to 2 decimal places', () => {
    // 12.935200 to 12.935209 (fractional centimeters)
    const dist = calculateHaversineDistanceKm(12.9352, 77.6245, 12.935201, 77.624501);
    assert.equal(dist, 0);
  });

  test('TC-BOUND-DIST-05: Extremely large geographic distances (>1000km, inter-city) categorized out-of-range', () => {
    // Bengaluru to Mumbai coordinates (~840 km)
    const bToM = calculateHaversineDistanceKm(12.9716, 77.5946, 19.076, 72.8777);
    assert.ok(bToM > 800 && bToM < 900);

    const tierM = calculateStoreTier(bToM);
    assert.equal(tierM.tier, 'out-of-range');
    assert.equal(tierM.isFlashHero, false);
    assert.equal(tierM.estimatedPickupMinutes, null);

    // Bengaluru to Delhi (~1740 km)
    const bToD = calculateHaversineDistanceKm(12.9716, 77.5946, 28.6139, 77.209);
    assert.ok(bToD > 1700 && bToD < 1800);
    assert.equal(calculateStoreTier(bToD).tier, 'out-of-range');
  });
});
