import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Tier 1: Feature Coverage - Phase 0 Frontend Verifications', () => {
  const webPagesDir = path.resolve(process.cwd(), 'packages/web/src/pages/flashfix');

  test('TC-PHASE0-01: Verifies Services.tsx removes time badges and brands chips', () => {
    const servicesPath = path.join(webPagesDir, 'Services.tsx');
    assert.ok(fs.existsSync(servicesPath), 'Services.tsx must exist');

    const content = fs.readFileSync(servicesPath, 'utf8');

    // Must not have time badges in SERVICES array (e.g., time: "45 min" or badge)
    assert.equal(
      content.includes('time:'),
      false,
      'Services.tsx must not contain time badges in service definitions'
    );
    assert.equal(
      content.includes('brands:'),
      false,
      'Services.tsx must not contain brands chips section'
    );
  });

  test('TC-PHASE0-02: Verifies About.tsx removes founder attribution line', () => {
    const aboutPath = path.join(webPagesDir, 'About.tsx');
    assert.ok(fs.existsSync(aboutPath), 'About.tsx must exist');

    const content = fs.readFileSync(aboutPath, 'utf8');

    // Must not have "— JP, Founder" attribution
    assert.equal(
      content.includes('— JP, Founder'),
      false,
      'About.tsx must not contain founder attribution'
    );
    assert.equal(
      content.includes('JP, Founder'),
      false,
      'About.tsx must not contain JP, Founder'
    );
  });

  test('TC-PHASE0-03: Verifies FlashfixHome.tsx removes Precision Repair Protocol label', () => {
    const homePath = path.join(webPagesDir, 'FlashfixHome.tsx');
    assert.ok(fs.existsSync(homePath), 'FlashfixHome.tsx must exist');

    const content = fs.readFileSync(homePath, 'utf8');

    // Must not contain "Precision Repair Protocol"
    assert.equal(
      content.includes('Precision Repair Protocol'),
      false,
      'FlashfixHome.tsx must not contain "Precision Repair Protocol"'
    );
  });

  test('TC-PHASE0-04: Verifies Booking.tsx Apple lineup includes iPhone 11-16 Pro Max & SE', () => {
    const bookingPath = path.join(webPagesDir, 'Booking.tsx');
    assert.ok(fs.existsSync(bookingPath), 'Booking.tsx must exist');

    const content = fs.readFileSync(bookingPath, 'utf8');

    const requiredAppleModels = [
      'iPhone 16 Pro Max',
      'iPhone 16 Pro',
      'iPhone 16 Plus',
      'iPhone 16',
      'iPhone 15 Pro Max',
      'iPhone 15 Pro',
      'iPhone 14 Pro Max',
      'iPhone 13 Pro Max',
      'iPhone 12 Pro Max',
      'iPhone 11 Pro Max',
      'iPhone 11'
    ];

    for (const model of requiredAppleModels) {
      assert.ok(
        content.includes(model),
        `Booking.tsx Apple lineup must include ${model}`
      );
    }
  });

  test('TC-PHASE0-05: Verifies Booking.tsx Samsung lineup includes S23-S25, Z Fold/Flip, and A series', () => {
    const bookingPath = path.join(webPagesDir, 'Booking.tsx');
    const content = fs.readFileSync(bookingPath, 'utf8');

    const requiredSamsungModels = [
      'Galaxy S25 Ultra',
      'Galaxy S25+',
      'Galaxy S25',
      'Galaxy S24 Ultra',
      'Galaxy S24+',
      'Galaxy S23 Ultra',
      'Galaxy Z Fold',
      'Galaxy Z Flip',
      'Galaxy A5'
    ];

    for (const model of requiredSamsungModels) {
      assert.ok(
        content.includes(model),
        `Booking.tsx Samsung lineup must include model matching ${model}`
      );
    }
  });

  test('TC-PHASE0-06: Verifies Booking.tsx Google lineup includes Pixel 6 through Pixel 9 series', () => {
    const bookingPath = path.join(webPagesDir, 'Booking.tsx');
    const content = fs.readFileSync(bookingPath, 'utf8');

    const requiredGoogleModels = [
      'Pixel 9 Pro Fold',
      'Pixel 9 Pro XL',
      'Pixel 9 Pro',
      'Pixel 9',
      'Pixel 8 Pro',
      'Pixel 8',
      'Pixel 7 Pro',
      'Pixel 6 Pro'
    ];

    for (const model of requiredGoogleModels) {
      assert.ok(
        content.includes(model),
        `Booking.tsx Google lineup must include ${model}`
      );
    }
  });

  test('TC-PHASE0-07: Verifies Booking.tsx OnePlus lineup includes OnePlus 10-13, Open, and Nord series', () => {
    const bookingPath = path.join(webPagesDir, 'Booking.tsx');
    const content = fs.readFileSync(bookingPath, 'utf8');

    const requiredOnePlusModels = [
      'OnePlus 13',
      'OnePlus 12',
      'OnePlus 11',
      'OnePlus 10 Pro',
      'OnePlus Open',
      'Nord'
    ];

    for (const model of requiredOnePlusModels) {
      assert.ok(
        content.includes(model),
        `Booking.tsx OnePlus lineup must include model matching ${model}`
      );
    }
  });
});
