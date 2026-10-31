import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

describe('Challenger M5-2: Empirical Adversarial Verification of Render Blueprint & Deployment Artifacts', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const renderJsonPath = path.resolve(rootDir, 'render.json');

  before(() => {
    if (!fs.existsSync(renderJsonPath)) {
      execSync('powershell -Command "Get-Content render.yaml -Raw | npx yaml --json | Out-File -Encoding utf8 render.json"', {
        cwd: rootDir,
        stdio: 'pipe',
      });
    }
  });

  after(() => {
    if (fs.existsSync(renderJsonPath)) {
      fs.unlinkSync(renderJsonPath);
    }
  });

  test('TC-CHALLENGE-01: render.json parsed from render.yaml is schema-compliant', () => {
    assert.ok(fs.existsSync(renderJsonPath), 'render.json must exist');
    const raw = fs.readFileSync(renderJsonPath, 'utf8').trim();
    const parsed = JSON.parse(raw);
    const doc = Array.isArray(parsed) ? parsed[0] : parsed;

    assert.ok(doc.services && Array.isArray(doc.services), 'render.yaml must have services array');
    assert.ok(doc.databases && Array.isArray(doc.databases), 'render.yaml must have databases array');
    assert.equal(doc.databases.length, 1, 'Must have exactly 1 database');

    const db = doc.databases[0];
    assert.equal(db.name, 'flashfix-db');
    assert.equal(db.databaseName, 'flashfix');
    assert.equal(db.user, 'flashfix');
    assert.equal(db.postgresMajorVersion, '16');
    assert.equal(db.region, 'singapore');
  });

  test('TC-CHALLENGE-02: Exactly 9 services present (6 microservices, 2 frontends, 1 gateway)', () => {
    const raw = fs.readFileSync(renderJsonPath, 'utf8').trim();
    const doc = (Array.isArray(JSON.parse(raw)) ? JSON.parse(raw)[0] : JSON.parse(raw));
    const services = doc.services;

    assert.equal(services.length, 9, 'Must have exactly 9 services defined in render.yaml');

    const expectedServices = [
      { name: 'flashfix-auth-service', type: 'web', port: '3001' },
      { name: 'flashfix-booking-service', type: 'web', port: '3002' },
      { name: 'flashfix-notify-service', type: 'pserv', port: '3005' },
      { name: 'flashfix-store-service', type: 'web', port: '3006' },
      { name: 'flashfix-admin-api', type: 'web', port: '3007' },
      { name: 'flashfix-inventory-service', type: 'web', port: '3008' },
      { name: 'flashfix-web', type: 'web', port: '80' },
      { name: 'flashfix-admin-panel', type: 'web', port: '80' },
      { name: 'flashfix-gateway', type: 'web', port: '80' },
    ];

    for (const exp of expectedServices) {
      const match = services.find((s: any) => s.name === exp.name);
      assert.ok(match, `Service ${exp.name} must exist`);
      assert.equal(match.type, exp.type, `Service ${exp.name} type must be ${exp.type}`);
      const portVar = match.envVars?.find((e: any) => e.key === 'PORT');
      assert.ok(portVar, `Service ${exp.name} must define PORT env var`);
      assert.equal(portVar.value, exp.port, `Service ${exp.name} PORT must be ${exp.port}`);
    }
  });

  test('TC-CHALLENGE-03: Environment variable wiring matches service graph and database', () => {
    const raw = fs.readFileSync(renderJsonPath, 'utf8').trim();
    const doc = (Array.isArray(JSON.parse(raw)) ? JSON.parse(raw)[0] : JSON.parse(raw));
    const services = doc.services;
    const serviceMap = new Map<string, any>(services.map((s: any) => [s.name, s]));

    // Check all envVars
    for (const svc of services) {
      for (const ev of svc.envVars || []) {
        if (ev.fromDatabase) {
          assert.equal(ev.fromDatabase.name, 'flashfix-db', `${svc.name} must reference flashfix-db`);
          assert.equal(ev.fromDatabase.property, 'connectionString', `${svc.name} must use connectionString`);
        }
        if (ev.fromService) {
          const target = serviceMap.get(ev.fromService.name);
          assert.ok(target, `${svc.name} references non-existent service ${ev.fromService.name}`);
          assert.equal(
            ev.fromService.type,
            target.type,
            `${svc.name} references ${ev.fromService.name} with mismatched service type`
          );
        }
      }
    }

    // Specific wiring assertions
    const authSvc = serviceMap.get('flashfix-auth-service');
    assert.ok(authSvc.envVars.find((e: any) => e.key === 'JWT_SECRET')?.generateValue, 'Auth service must generate JWT_SECRET');
    assert.ok(authSvc.envVars.find((e: any) => e.key === 'REFRESH_SECRET')?.generateValue, 'Auth service must generate REFRESH_SECRET');

    const bookingSvc = serviceMap.get('flashfix-booking-service');
    const bookingJwt = bookingSvc.envVars.find((e: any) => e.key === 'JWT_SECRET');
    assert.equal(bookingJwt?.fromService?.name, 'flashfix-auth-service', 'Booking service must import JWT_SECRET from auth-service');

    const adminApi = serviceMap.get('flashfix-admin-api');
    const adminJwt = adminApi.envVars.find((e: any) => e.key === 'JWT_SECRET');
    assert.equal(adminJwt?.fromService?.name, 'flashfix-auth-service', 'Admin API must import JWT_SECRET from auth-service');

    const inventorySvc = serviceMap.get('flashfix-inventory-service');
    const invJwt = inventorySvc.envVars.find((e: any) => e.key === 'JWT_SECRET');
    assert.equal(invJwt?.fromService?.name, 'flashfix-auth-service', 'Inventory service must import JWT_SECRET from auth-service');
  });

  test('TC-CHALLENGE-04: All Dockerfiles exist, have multi-stage builds and proper health checks', () => {
    const raw = fs.readFileSync(renderJsonPath, 'utf8').trim();
    const doc = (Array.isArray(JSON.parse(raw)) ? JSON.parse(raw)[0] : JSON.parse(raw));
    const services = doc.services;

    for (const svc of services) {
      assert.equal(svc.runtime, 'docker', `Service ${svc.name} runtime must be docker`);
      assert.ok(svc.dockerfilePath, `Service ${svc.name} must have dockerfilePath`);
      const fp = path.resolve(rootDir, svc.dockerfilePath);
      assert.ok(fs.existsSync(fp), `Dockerfile at ${svc.dockerfilePath} must exist`);
      const content = fs.readFileSync(fp, 'utf8');
      assert.ok(content.length > 50, `Dockerfile at ${svc.dockerfilePath} must not be empty`);

      // Microservices: must be multi-stage node:20-alpine
      if (svc.name.startsWith('flashfix-') && !['flashfix-web', 'flashfix-admin-panel', 'flashfix-gateway'].includes(svc.name)) {
        assert.ok(content.includes('FROM node:20-alpine AS builder'), `${svc.name} Dockerfile must have builder stage`);
        assert.ok(content.includes('FROM node:20-alpine AS runner'), `${svc.name} Dockerfile must have runner stage`);
        assert.ok(content.includes('USER node'), `${svc.name} Dockerfile must run as non-root node user`);
      }

      // Frontends: must be multi-stage builder + nginx runner
      if (['flashfix-web', 'flashfix-admin-panel'].includes(svc.name)) {
        assert.ok(content.includes('FROM node:20-alpine AS builder'), `${svc.name} must build with node builder`);
        assert.ok(content.includes('FROM nginx:1.27-alpine AS runner'), `${svc.name} must run with nginx runner`);
        assert.ok(content.includes('try_files $uri $uri/ /index.html;'), `${svc.name} must configure SPA routing fallback`);
      }

      // Gateway: must use nginx:1.27-alpine and copy nginx.conf
      if (svc.name === 'flashfix-gateway') {
        assert.ok(content.includes('FROM nginx:1.27-alpine'), 'Gateway must use nginx:1.27-alpine');
        assert.ok(content.includes('nginx.con[f]'), 'Gateway must copy nginx.conf');
        assert.ok(content.includes('HEALTHCHECK'), 'Gateway must have HEALTHCHECK instruction');
      }
    }
  });

  test('TC-CHALLENGE-05: Nginx Gateway rate limiting, security headers, and reverse proxy paths', () => {
    const nginxConfPath = path.resolve(rootDir, 'infra/nginx/nginx.conf');
    assert.ok(fs.existsSync(nginxConfPath), 'nginx.conf must exist');
    const content = fs.readFileSync(nginxConfPath, 'utf8');

    // Security headers
    assert.ok(content.includes('X-Content-Type-Options "nosniff"'), 'Must have nosniff header');
    assert.ok(content.includes('X-Frame-Options "DENY"'), 'Must have DENY frame options');
    assert.ok(content.includes('X-XSS-Protection "1; mode=block"'), 'Must have XSS protection header');

    // OTP Rate limiting
    assert.ok(content.includes('zone=otp_limit:10m rate=5r/m;'), 'Must have 5r/m rate limiting');
    assert.ok(content.includes('limit_req_status 429;'), 'Must return 429 status on limit hit');
    assert.ok(content.includes('limit_req zone=otp_limit burst=3 nodelay;'), 'Must have burst=3 nodelay');

    // Route locations
    const expectedLocations = [
      '/health',
      '/api/auth/send-otp',
      'send-pickup-otp',
      'send-custody-otp',
      '/api/auth',
      '/api/bookings',
      '/api/stores',
      '/api/admin',
      '/api/inventory',
      '/api/notify',
      '/admin',
      '/',
    ];
    for (const loc of expectedLocations) {
      assert.ok(content.includes(loc), `nginx.conf must define location matching '${loc}'`);
    }
  });
});
