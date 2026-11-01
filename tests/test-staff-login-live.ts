import 'dotenv/config';
import loginHandler from '../packages/web/api/admin/auth/login.js';

class MockResponse {
  statusCode: number = 200;
  headers: Record<string, string> = {};
  body: any = null;

  setHeader(name: string, value: string) {
    this.headers[name] = value;
    return this;
  }

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(data: any) {
    this.body = data;
    return this;
  }

  end() {
    return this;
  }
}

async function testStaffLogin() {
  console.log('Testing Staff Login against Neon DB...');

  // Test 1: Superadmin valid password
  const req1 = { method: 'POST', body: { email: 'superadmin@flashfix.in', password: 'Admin@123' } };
  const res1 = new MockResponse();
  await loginHandler(req1, res1);
  if (res1.statusCode !== 200) throw new Error(`Superadmin login failed with status ${res1.statusCode}: ${JSON.stringify(res1.body)}`);
  if (res1.body.user.role !== 'SUPER_ADMIN') throw new Error(`Expected role SUPER_ADMIN, got ${res1.body.user.role}`);
  console.log('✓ Superadmin login success:', res1.body.user.email, res1.body.user.role);

  // Test 2: Store Admin valid password & multi-store check
  const req2 = { method: 'POST', body: { email: 'admin@flashfix.in', password: 'Admin@123' } };
  const res2 = new MockResponse();
  await loginHandler(req2, res2);
  if (res2.statusCode !== 200) throw new Error(`Admin login failed with status ${res2.statusCode}: ${JSON.stringify(res2.body)}`);
  if (res2.body.user.role !== 'ADMIN') throw new Error(`Expected role ADMIN, got ${res2.body.user.role}`);
  console.log('✓ Store admin login success:', res2.body.user.email, 'Assigned stores:', res2.body.user.storeIds);

  // Test 3: Technician valid password
  const req3 = { method: 'POST', body: { email: 'tech@flashfix.in', password: 'Tech@123' } };
  const res3 = new MockResponse();
  await loginHandler(req3, res3);
  if (res3.statusCode !== 200) throw new Error(`Tech login failed with status ${res3.statusCode}: ${JSON.stringify(res3.body)}`);
  if (res3.body.user.role !== 'TECHNICIAN') throw new Error(`Expected role TECHNICIAN, got ${res3.body.user.role}`);
  console.log('✓ Technician login success:', res3.body.user.email, res3.body.user.role);

  // Test 4: Delivery Rider valid password
  const req4 = { method: 'POST', body: { email: 'rider@flashfix.in', password: 'Rider@123' } };
  const res4 = new MockResponse();
  await loginHandler(req4, res4);
  if (res4.statusCode !== 200) throw new Error(`Rider login failed with status ${res4.statusCode}: ${JSON.stringify(res4.body)}`);
  if (res4.body.user.role !== 'EMPLOYEE') throw new Error(`Expected role EMPLOYEE, got ${res4.body.user.role}`);
  console.log('✓ Rider login success:', res4.body.user.email, res4.body.user.role);

  // Test 5: Wrong password -> 401
  const req5 = { method: 'POST', body: { email: 'superadmin@flashfix.in', password: 'WrongPassword' } };
  const res5 = new MockResponse();
  await loginHandler(req5, res5);
  if (res5.statusCode !== 401) throw new Error(`Expected 401 for wrong password, got ${res5.statusCode}`);
  console.log('✓ Wrong password rejected with 401');

  // Test 6: Consumer email -> 401 not authorized as staff
  const req6 = { method: 'POST', body: { email: 'consumer@flashfix.in', password: 'Password@123' } };
  const res6 = new MockResponse();
  await loginHandler(req6, res6);
  if (res6.statusCode !== 401) throw new Error(`Expected 401 for consumer email, got ${res6.statusCode}`);
  console.log('✓ Consumer email rejected from staff login with 401');

  console.log('\n🎉 ALL STAFF LOGIN TESTS PASSED PERFECTLY! 🎉');
}

testStaffLogin().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
