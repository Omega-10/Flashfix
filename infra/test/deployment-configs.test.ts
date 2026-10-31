import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

describe('Milestone 5: Deployment Configurations & Gateway Architecture', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const infraDir = path.resolve(rootDir, 'infra');
  const nginxConfPath = path.resolve(infraDir, 'nginx/nginx.conf');
  const nginxDockerfilePath = path.resolve(infraDir, 'nginx/Dockerfile');
  const dockerComposePath = path.resolve(infraDir, 'docker-compose.yml');
  const renderYamlPath = path.resolve(rootDir, 'render.yaml');

  test('TC-M5-01: Nginx Gateway configuration exists and defines OTP rate limiting and upstreams', () => {
    assert.ok(fs.existsSync(nginxConfPath), 'infra/nginx/nginx.conf must exist');
    const content = fs.readFileSync(nginxConfPath, 'utf8');

    // Port 80
    assert.ok(/listen\s+80;/.test(content), 'Gateway must listen on Port 80');

    // OTP Rate limiting zone
    assert.ok(
      content.includes('limit_req_zone $binary_remote_addr zone=otp_limit:10m rate=5r/m;'),
      'Must define limit_req_zone with 10m zone and 5r/m rate'
    );
    assert.ok(content.includes('limit_req_status 429;'), 'Must return 429 status on rate limit');

    // Rate limit application
    assert.ok(
      content.includes('location = /api/auth/send-otp'),
      'Must define rate-limited location for /api/auth/send-otp'
    );
    assert.ok(
      content.includes('send-pickup-otp'),
      'Must define rate-limited location for pickup OTP'
    );
    assert.ok(
      content.includes('send-custody-otp'),
      'Must define rate-limited location for custody OTP'
    );
    assert.ok(
      content.includes('limit_req zone=otp_limit burst=3 nodelay;'),
      'Must apply burst=3 nodelay to OTP endpoints'
    );

    // Upstreams
    const expectedUpstreams = [
      'auth-service:3001',
      'booking-service:3002',
      'store-service:3006',
      'admin-api:3007',
      'inventory-service:3008',
      'notify-service:3005',
      'admin-panel:80',
      'web:80',
    ];

    for (const upstream of expectedUpstreams) {
      assert.ok(
        content.includes(upstream),
        `Must define upstream referencing ${upstream}`
      );
    }

    // Balanced braces check
    let balance = 0;
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      for (const ch of trimmed) {
        if (ch === '{') balance++;
        if (ch === '}') balance--;
      }
    }
    assert.equal(balance, 0, 'Nginx configuration must have balanced braces');
  });

  test('TC-M5-02: Nginx Gateway Dockerfile exists and configures healthcheck', () => {
    assert.ok(fs.existsSync(nginxDockerfilePath), 'infra/nginx/Dockerfile must exist');
    const content = fs.readFileSync(nginxDockerfilePath, 'utf8');

    assert.ok(content.includes('FROM nginx:'), 'Must be based on nginx base image');
    assert.ok(content.includes('EXPOSE 80'), 'Must expose port 80');
    assert.ok(content.includes('HEALTHCHECK'), 'Must include HEALTHCHECK');
    assert.ok(content.includes('/etc/nginx/'), 'Must install nginx configuration');
  });

  test('TC-M5-03: All required service and frontend Dockerfiles exist', () => {
    const requiredDockerfiles = [
      'services/auth-service/Dockerfile',
      'services/booking-service/Dockerfile',
      'services/notify-service/Dockerfile',
      'services/store-service/Dockerfile',
      'services/admin-api/Dockerfile',
      'services/inventory-service/Dockerfile',
      'packages/web/Dockerfile',
      'apps/admin-panel/Dockerfile',
      'infra/nginx/Dockerfile',
    ];

    for (const relPath of requiredDockerfiles) {
      const fullPath = path.resolve(rootDir, relPath);
      assert.ok(fs.existsSync(fullPath), `Dockerfile at ${relPath} must exist`);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(content.length > 50, `Dockerfile at ${relPath} must not be empty`);
    }
  });

  test('TC-M5-04: Docker Compose orchestrates all 6 services, postgres, frontends, and gateway', () => {
    assert.ok(fs.existsSync(dockerComposePath), 'infra/docker-compose.yml must exist');
    const content = fs.readFileSync(dockerComposePath, 'utf8');

    const expectedServices = [
      'postgres',
      'notify-service',
      'auth-service',
      'store-service',
      'booking-service',
      'admin-api',
      'inventory-service',
      'web',
      'admin-panel',
      'gateway',
    ];

    for (const svc of expectedServices) {
      assert.ok(
        content.includes(`${svc}:`),
        `docker-compose.yml must define service '${svc}'`
      );
    }

    // Verify postgres version and healthcheck
    assert.ok(content.includes('postgres:16-alpine'), 'Postgres service must use postgres:16-alpine');
    assert.ok(content.includes('pg_isready'), 'Postgres service must define pg_isready healthcheck');

    // Verify environment variables & dependencies
    assert.ok(content.includes('NOTIFY_SERVICE_URL'), 'Must pass NOTIFY_SERVICE_URL to services');
    assert.ok(content.includes('BOOKING_SERVICE_URL'), 'Must pass BOOKING_SERVICE_URL to admin-api');
    assert.ok(content.includes('flashfix-net'), 'Must define flashfix-net network');
    assert.ok(content.includes('pgdata'), 'Must define pgdata volume');
  });

  test('TC-M5-05: Docker Compose config validation runs with zero errors', () => {
    try {
      execSync('docker compose -f infra/docker-compose.yml config --quiet', {
        cwd: rootDir,
        stdio: 'pipe',
      });
    } catch (err: any) {
      assert.fail(`docker compose config validation failed: ${err.stderr?.toString() || err.message}`);
    }
  });

  test('TC-M5-06: Render Blueprint specification render.yaml is valid and defines full stack', () => {
    assert.ok(fs.existsSync(renderYamlPath), 'render.yaml must exist at repository root');
    const content = fs.readFileSync(renderYamlPath, 'utf8');

    // Must define services and databases
    assert.ok(content.includes('services:'), 'render.yaml must contain services: block');
    assert.ok(content.includes('databases:'), 'render.yaml must contain databases: block');

    const expectedRenderServices = [
      'flashfix-gateway',
      'flashfix-auth-service',
      'flashfix-booking-service',
      'flashfix-notify-service',
      'flashfix-store-service',
      'flashfix-admin-api',
      'flashfix-inventory-service',
      'flashfix-web',
      'flashfix-admin-panel',
    ];

    for (const svc of expectedRenderServices) {
      assert.ok(
        content.includes(`name: ${svc}`),
        `render.yaml must define service '${svc}'`
      );
    }

    // Managed database
    assert.ok(content.includes('name: flashfix-db'), 'Must define managed Postgres database flashfix-db');
    assert.ok(content.includes('postgresMajorVersion: "16"'), 'Database must specify version 16');

    // Verify health checks on microservices
    assert.ok(content.includes('healthCheckPath: /health'), 'Must configure health check paths on services');
  });

  test('TC-M5-07: All 8 TypeScript Dockerfiles copy tsconfig.base.json in builder stage', () => {
    const tsDockerfiles = [
      'services/auth-service/Dockerfile',
      'services/booking-service/Dockerfile',
      'services/notify-service/Dockerfile',
      'services/store-service/Dockerfile',
      'services/admin-api/Dockerfile',
      'services/inventory-service/Dockerfile',
      'packages/web/Dockerfile',
      'apps/admin-panel/Dockerfile',
    ];

    for (const relPath of tsDockerfiles) {
      const fullPath = path.resolve(rootDir, relPath);
      assert.ok(fs.existsSync(fullPath), `Dockerfile at ${relPath} must exist`);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(
        content.includes('tsconfig.base.json'),
        `Dockerfile at ${relPath} must copy tsconfig.base.json in builder stage`
      );
    }
  });

  test('TC-M5-08: All 6 Node microservice Dockerfiles define container HEALTHCHECK', () => {
    const serviceDockerfiles = [
      'services/auth-service/Dockerfile',
      'services/booking-service/Dockerfile',
      'services/notify-service/Dockerfile',
      'services/store-service/Dockerfile',
      'services/admin-api/Dockerfile',
      'services/inventory-service/Dockerfile',
    ];

    for (const relPath of serviceDockerfiles) {
      const fullPath = path.resolve(rootDir, relPath);
      assert.ok(fs.existsSync(fullPath), `Dockerfile at ${relPath} must exist`);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(
        content.includes('HEALTHCHECK'),
        `Dockerfile at ${relPath} must define HEALTHCHECK instruction`
      );
      assert.ok(
        content.includes('/health'),
        `Dockerfile at ${relPath} HEALTHCHECK must target /health endpoint`
      );
    }
  });

  test('TC-M5-09: Root package-lock.json contains all microservice and app workspaces', () => {
    const lockPath = path.resolve(rootDir, 'package-lock.json');
    assert.ok(fs.existsSync(lockPath), 'package-lock.json must exist');
    const lockContent = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

    const expectedWorkspaces = [
      'services/auth-service',
      'services/booking-service',
      'services/notify-service',
      'services/store-service',
      'services/admin-api',
      'services/inventory-service',
      'apps/admin-panel',
      'packages/shared',
      'packages/web',
    ];

    for (const ws of expectedWorkspaces) {
      assert.ok(
        lockContent.packages[ws] !== undefined,
        `package-lock.json must index workspace package '${ws}'`
      );
    }
  });

  test('TC-M5-10: Nginx gateway configuration supports dynamic upstreams script and fallback template', () => {
    const scriptPath = path.resolve(infraDir, 'nginx/docker-entrypoint.sh');
    assert.ok(fs.existsSync(scriptPath), 'infra/nginx/docker-entrypoint.sh must exist');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    assert.ok(scriptContent.includes('AUTH_UPSTREAM'), 'Script must configure AUTH_UPSTREAM');
    assert.ok(scriptContent.includes('auth-service:3001'), 'Script must have compose fallback auth-service:3001');

    const templatePath = path.resolve(infraDir, 'nginx/templates/default.conf.template');
    assert.ok(fs.existsSync(templatePath), 'infra/nginx/templates/default.conf.template must exist');
  });
});
