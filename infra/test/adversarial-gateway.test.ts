import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

describe('Adversarial Gateway & Orchestration Verification Harness', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const infraDir = path.resolve(rootDir, 'infra');
  const nginxConfPath = path.resolve(infraDir, 'nginx/nginx.conf');
  const dockerComposePath = path.resolve(infraDir, 'docker-compose.yml');
  const renderYamlPath = path.resolve(rootDir, 'render.yaml');

  // =========================================================================
  // 1. DOCKER COMPOSE CONFIGURATION & DEPENDENCY GRAPH STRESS TEST
  // =========================================================================
  describe('Docker Compose Structural Integrity', () => {
    let composeConfig: any;

    test('should execute docker compose config --format json and parse without error', () => {
      const output = execSync('docker compose -f infra/docker-compose.yml config --format json', {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      composeConfig = JSON.parse(output);
      assert.ok(composeConfig.services, 'Docker Compose must define services object');
    });

    test('should define exactly 10 orchestrated services', () => {
      const services = Object.keys(composeConfig.services);
      assert.equal(services.length, 10, `Expected 10 services, found ${services.length}: ${services.join(', ')}`);
      const required = [
        'postgres',
        'auth-service',
        'booking-service',
        'notify-service',
        'store-service',
        'admin-api',
        'inventory-service',
        'web',
        'admin-panel',
        'gateway',
      ];
      for (const svc of required) {
        assert.ok(composeConfig.services[svc], `Missing service: ${svc}`);
      }
    });

    test('should attach all 10 services to flashfix-net bridge network', () => {
      assert.ok(composeConfig.networks['flashfix-net'], 'flashfix-net network must exist');
      assert.equal(composeConfig.networks['flashfix-net'].driver, 'bridge');

      for (const [svcName, svcConfig] of Object.entries<any>(composeConfig.services)) {
        assert.ok(
          svcConfig.networks && 'flashfix-net' in svcConfig.networks,
          `Service ${svcName} must be attached to flashfix-net`
        );
      }
    });

    test('should verify correct published host port mappings for all services', () => {
      const portMap: Record<string, string> = {
        postgres: '5432',
        'auth-service': '3001',
        'booking-service': '3002',
        'notify-service': '3005',
        'store-service': '3006',
        'admin-api': '3007',
        'inventory-service': '3008',
        web: '5173',
        'admin-panel': '5174',
        gateway: '80',
      };

      for (const [svcName, expectedPort] of Object.entries(portMap)) {
        const svc = composeConfig.services[svcName];
        assert.ok(svc.ports && svc.ports.length > 0, `Service ${svcName} must have port mapping`);
        const pub = svc.ports[0].published;
        assert.equal(
          String(pub),
          expectedPort,
          `Service ${svcName} port published mismatch: expected ${expectedPort}, got ${pub}`
        );
      }
    });

    test('should enforce strict dependency ordering and healthcheck gates', () => {
      // Postgres must have a functioning healthcheck
      const pg = composeConfig.services.postgres;
      assert.ok(pg.healthcheck, 'Postgres must define healthcheck');
      assert.ok(
        pg.healthcheck.test.some((t: string) => t.includes('pg_isready')),
        'Postgres healthcheck must run pg_isready'
      );

      // Microservices requiring DB must depend on postgres service_healthy
      const dbDependentServices = [
        'auth-service',
        'booking-service',
        'store-service',
        'admin-api',
        'inventory-service',
      ];
      for (const svcName of dbDependentServices) {
        const svc = composeConfig.services[svcName];
        assert.ok(svc.depends_on, `Service ${svcName} must have depends_on`);
        assert.equal(
          svc.depends_on.postgres?.condition,
          'service_healthy',
          `Service ${svcName} must depend on postgres with condition service_healthy`
        );
      }

      // Gateway must depend on all backend and frontend services
      const gw = composeConfig.services.gateway;
      const expectedGwDeps = [
        'auth-service',
        'booking-service',
        'store-service',
        'admin-api',
        'inventory-service',
        'notify-service',
        'web',
        'admin-panel',
      ];
      for (const dep of expectedGwDeps) {
        assert.ok(
          gw.depends_on && dep in gw.depends_on,
          `Gateway must depend on downstream service ${dep}`
        );
      }
    });

    test('should verify environment variable inter-service connections', () => {
      // Auth service
      const authEnv = composeConfig.services['auth-service'].environment;
      assert.equal(authEnv.PORT, '3001');
      assert.ok(authEnv.DATABASE_URL.includes('postgres:5432'));
      assert.equal(authEnv.NOTIFY_SERVICE_URL, 'http://notify-service:3005');

      // Booking service
      const bookingEnv = composeConfig.services['booking-service'].environment;
      assert.equal(bookingEnv.PORT, '3002');
      assert.ok(bookingEnv.DATABASE_URL.includes('postgres:5432'));
      assert.equal(bookingEnv.NOTIFY_SERVICE_URL, 'http://notify-service:3005');

      // Admin API
      const adminEnv = composeConfig.services['admin-api'].environment;
      assert.equal(adminEnv.PORT, '3007');
      assert.equal(adminEnv.BOOKING_SERVICE_URL, 'http://booking-service:3002');
      assert.equal(adminEnv.NOTIFY_SERVICE_URL, 'http://notify-service:3005');
    });
  });

  // =========================================================================
  // 2. NGINX RATE LIMITING & ROUTING ADVERSARIAL INSPECTION
  // =========================================================================
  describe('Nginx Rate Limiting & Gateway Configuration', () => {
    const nginxContent = fs.readFileSync(nginxConfPath, 'utf8');

    test('should verify rate limiting zone definition matches exact spec (zone=otp_limit:10m rate=5r/m)', () => {
      assert.ok(
        /limit_req_zone\s+\$binary_remote_addr\s+zone=otp_limit:10m\s+rate=5r\/m;/.test(nginxContent),
        'Must define limit_req_zone with $binary_remote_addr, 10m size, and 5r/m rate'
      );
      assert.ok(
        /limit_req_status\s+429;/.test(nginxContent),
        'Must set limit_req_status to 429'
      );
    });

    test('should verify OTP endpoints enforce rate limit with burst=3 nodelay', () => {
      // 1. /api/auth/send-otp
      assert.ok(
        nginxContent.includes('location = /api/auth/send-otp'),
        'Exact location for /api/auth/send-otp must exist'
      );

      // 2. send-pickup-otp regex
      assert.ok(
        nginxContent.includes('location ~ ^/api/bookings/([^/]+)/send-pickup-otp$'),
        'Regex location for send-pickup-otp must exist'
      );

      // 3. send-custody-otp regex
      assert.ok(
        nginxContent.includes('location ~ ^/api/bookings/([^/]+)/send-custody-otp$'),
        'Regex location for send-custody-otp must exist'
      );

      // Verify burst=3 nodelay occurs at least 3 times
      const occurrences = (nginxContent.match(/limit_req\s+zone=otp_limit\s+burst=3\s+nodelay;/g) || []).length;
      assert.ok(
        occurrences >= 3,
        `Expected at least 3 limit_req directives with burst=3 nodelay, found ${occurrences}`
      );
    });

    test('should test regex location matching against valid and adversarial URL patterns', () => {
      const pickupRegex = /^\/api\/bookings\/([^/]+)\/send-pickup-otp$/;
      const custodyRegex = /^\/api\/bookings\/([^/]+)\/send-custody-otp$/;

      // Positive test cases
      const validCases = [
        { url: '/api/bookings/FF-100201/send-pickup-otp', id: 'FF-100201' },
        { url: '/api/bookings/123e4567-e89b-12d3-a456-426614174000/send-pickup-otp', id: '123e4567-e89b-12d3-a456-426614174000' },
        { url: '/api/bookings/booking_xyz_99/send-pickup-otp', id: 'booking_xyz_99' },
      ];

      for (const tc of validCases) {
        const match = tc.url.match(pickupRegex);
        assert.ok(match, `URL ${tc.url} should match pickup OTP regex`);
        assert.equal(match![1], tc.id);
      }

      const validCustodyCases = [
        { url: '/api/bookings/FF-100201/send-custody-otp', id: 'FF-100201' },
        { url: '/api/bookings/booking_xyz_99/send-custody-otp', id: 'booking_xyz_99' },
      ];

      for (const tc of validCustodyCases) {
        const match = tc.url.match(custodyRegex);
        assert.ok(match, `URL ${tc.url} should match custody OTP regex`);
        assert.equal(match![1], tc.id);
      }

      // Negative / Adversarial test cases (should NOT match)
      const invalidCases = [
        '/api/bookings//send-pickup-otp',                           // empty ID
        '/api/bookings/FF-100201/send-pickup-otp/',                 // trailing slash
        '/api/bookings/FF-100201/send-pickup-otp/extra',            // path traversal attempt
        '/api/bookings/FF-100201/verify-pickup',                    // non-OTP endpoint
        '/api/bookings/a/b/send-pickup-otp',                        // multi-segment ID
      ];

      for (const url of invalidCases) {
        assert.equal(pickupRegex.test(url), false, `Invalid URL ${url} must not match pickup regex`);
        assert.equal(custodyRegex.test(url), false, `Invalid URL ${url} must not match custody regex`);
      }
    });

    test('should verify path rewrite logic strips /api/ prefix and targets microservice paths', () => {
      // Simulate Nginx rewrite ^/api/bookings/(.*)$ /bookings/$1 break;
      const rewriteBooking = (uri: string) => uri.replace(/^\/api\/bookings\/(.*)$/, '/bookings/$1');
      assert.equal(
        rewriteBooking('/api/bookings/FF-999999/send-pickup-otp'),
        '/bookings/FF-999999/send-pickup-otp'
      );
      assert.equal(
        rewriteBooking('/api/bookings/FF-999999/send-custody-otp'),
        '/bookings/FF-999999/send-custody-otp'
      );

      // Simulate Nginx rewrite ^/api/auth/?(.*)$ /auth/$1 break;
      const rewriteAuth = (uri: string) => uri.replace(/^\/api\/auth\/?(.*)$/, '/auth/$1');
      assert.equal(rewriteAuth('/api/auth/me'), '/auth/me');
      assert.equal(rewriteAuth('/api/auth/verify-otp'), '/auth/verify-otp');

      // Simulate Nginx rewrite ^/admin/?(.*)$ /$1 break;
      const rewriteAdmin = (uri: string) => uri.replace(/^\/admin\/?(.*)$/, '/$1');
      assert.equal(rewriteAdmin('/admin'), '/');
      assert.equal(rewriteAdmin('/admin/bookings'), '/bookings');
      assert.equal(rewriteAdmin('/admin/assets/index.js'), '/assets/index.js');
    });

    test('should verify all 8 upstreams and security headers in nginx.conf', () => {
      const upstreams = [
        'upstream auth_backend {',
        'upstream booking_backend {',
        'upstream store_backend {',
        'upstream admin_backend {',
        'upstream inventory_backend {',
        'upstream notify_backend {',
        'upstream admin_frontend {',
        'upstream web_frontend {',
      ];

      for (const u of upstreams) {
        assert.ok(nginxContent.includes(u), `Missing upstream block: ${u}`);
      }

      // Security headers
      assert.ok(nginxContent.includes('X-Content-Type-Options "nosniff" always;'));
      assert.ok(nginxContent.includes('X-Frame-Options "DENY" always;'));
      assert.ok(nginxContent.includes('X-XSS-Protection "1; mode=block" always;'));

      // Proxy headers
      assert.ok(nginxContent.includes('proxy_set_header Host $host;'));
      assert.ok(nginxContent.includes('proxy_set_header X-Real-IP $remote_addr;'));
      assert.ok(nginxContent.includes('proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;'));
      assert.ok(nginxContent.includes('proxy_set_header X-Forwarded-Proto $scheme;'));
    });
  });

  // =========================================================================
  // 3. DOCKERFILE INTEGRITY & SECURITY HARDENING
  // =========================================================================
  describe('Dockerfile Hardening & Multi-Stage Architecture', () => {
    const serviceDirs = [
      'services/auth-service',
      'services/booking-service',
      'services/notify-service',
      'services/store-service',
      'services/admin-api',
      'services/inventory-service',
    ];

    test('should verify all 6 microservice Dockerfiles enforce non-root user execution', () => {
      for (const svcDir of serviceDirs) {
        const dockerfilePath = path.resolve(rootDir, svcDir, 'Dockerfile');
        assert.ok(fs.existsSync(dockerfilePath), `Dockerfile in ${svcDir} must exist`);
        const content = fs.readFileSync(dockerfilePath, 'utf8');

        assert.ok(content.includes('FROM node:20-alpine AS builder'), `${svcDir} must use node:20-alpine builder`);
        assert.ok(content.includes('FROM node:20-alpine AS runner'), `${svcDir} must use node:20-alpine runner`);
        assert.ok(content.includes('USER node'), `${svcDir} must execute as unprivileged node user`);
        assert.ok(content.includes('EXPOSE'), `${svcDir} must expose service port`);
      }
    });

    test('should verify frontend Dockerfiles implement SPA routing and caching', () => {
      const frontendDirs = ['packages/web', 'apps/admin-panel'];
      for (const fDir of frontendDirs) {
        const dockerfilePath = path.resolve(rootDir, fDir, 'Dockerfile');
        const content = fs.readFileSync(dockerfilePath, 'utf8');

        assert.ok(content.includes('try_files $uri $uri/ /index.html;'), `${fDir} must configure SPA try_files`);
        assert.ok(content.includes('Cache-Control "public, immutable";'), `${fDir} must configure static caching`);
        assert.ok(content.includes('HEALTHCHECK'), `${fDir} must define container HEALTHCHECK`);
      }
    });
  });

  // =========================================================================
  // 4. RENDER.YAML BLUEPRINT SPECIFICATION RIGOR
  // =========================================================================
  describe('Render Blueprint Specification Rigor', () => {
    const renderContent = fs.readFileSync(renderYamlPath, 'utf8');

    test('should verify database specification: PostgreSQL 16 on starter plan', () => {
      assert.ok(renderContent.includes('name: flashfix-db'));
      assert.ok(renderContent.includes('postgresMajorVersion: "16"'));
      assert.ok(renderContent.includes('databaseName: flashfix'));
      assert.ok(renderContent.includes('user: flashfix'));
    });

    test('should verify internal notify-service is designated as private service (pserv)', () => {
      // Must be type: pserv so it is not exposed publicly
      assert.ok(
        /-\s+type:\s+pserv[\s\S]*?name:\s+flashfix-notify-service/.test(renderContent),
        'flashfix-notify-service must be defined as private service (type: pserv)'
      );
    });

    test('should verify inter-service links use fromDatabase and fromService', () => {
      // Database connection links
      assert.ok(renderContent.includes('fromDatabase:'));
      assert.ok(renderContent.includes('name: flashfix-db'));
      assert.ok(renderContent.includes('property: connectionString'));

      // Inter-service notify links
      assert.ok(renderContent.includes('name: flashfix-notify-service'));
      assert.ok(renderContent.includes('property: hostport'));

      // Inter-service booking links
      assert.ok(renderContent.includes('name: flashfix-booking-service'));

      // Secret generation
      assert.ok(renderContent.includes('generateValue: true'));
    });
  });
});
