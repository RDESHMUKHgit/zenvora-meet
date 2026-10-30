/* eslint-disable @typescript-eslint/no-explicit-any */
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { users } from '../db/schema/users.schema.js';
import { authSessions } from '../db/schema/sessions.schema.js';
import { hashSessionToken } from '../utils/crypto.js';
import { eq } from 'drizzle-orm';
import type { Server } from 'http';

async function runAuthTests() {
  console.log('--- Starting Authentication Integration Tests ---');
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://localhost:${port}/api/auth`;
  console.log(`Test server running on ${baseUrl}`);

  const testEmail = `test.user.${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const testName = 'Test User';

  let sessionCookie = '';
  let csrfCookie = '';
  let csrfTokenValue = '';

  try {
    // 1. Test Registration
    console.log('\n[Test 1] POST /api/auth/register (New User)');
    const regRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testName, email: testEmail, password: testPassword }),
    });

    const regData = (await regRes.json()) as any;
    console.log(`Status: ${regRes.status}`);
    console.log(`Response:`, regData);
    if (regRes.status !== 201 || !regData.success) {
      throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
    }

    if (regData.data.user.passwordHash) {
      throw new Error('SECURITY VIOLATION: passwordHash leaked in registration response!');
    }

    // Extract cookies
    const rawSetCookies = regRes.headers.getSetCookie ? regRes.headers.getSetCookie() : [];
    for (const cookieStr of rawSetCookies) {
      if (cookieStr.startsWith('session_token=')) {
        sessionCookie = cookieStr.split(';')[0];
      }
      if (cookieStr.startsWith('csrf_token=')) {
        csrfCookie = cookieStr.split(';')[0];
        csrfTokenValue = csrfCookie.replace('csrf_token=', '');
      }
    }
    console.log('Session Cookie received:', sessionCookie.slice(0, 25) + '...');
    console.log('CSRF Token received:', csrfTokenValue.slice(0, 15) + '...');

    // 2. Test Current User with Session Cookie
    console.log('\n[Test 2] GET /api/auth/me (Authenticated)');
    const meRes = await fetch(`${baseUrl}/me`, {
      headers: { Cookie: `${sessionCookie}; ${csrfCookie}` },
    });
    const meData = (await meRes.json()) as any;
    console.log(`Status: ${meRes.status}`);
    console.log(`User:`, meData.data?.user?.email);
    if (meRes.status !== 200 || meData.data?.user?.email !== testEmail) {
      throw new Error(`Current user verification failed: ${JSON.stringify(meData)}`);
    }

    // 3. Test Unauthorized Access without Cookie
    console.log('\n[Test 3] GET /api/auth/me (Unauthorized / No Cookie)');
    const unauthRes = await fetch(`${baseUrl}/me`);
    const unauthData = (await unauthRes.json()) as any;
    console.log(`Status: ${unauthRes.status}`);
    console.log(`Response:`, unauthData);
    if (unauthRes.status !== 401) {
      throw new Error(`Expected 401 Unauthorized but got ${unauthRes.status}`);
    }

    // 4. Test Duplicate Email Registration
    console.log('\n[Test 4] POST /api/auth/register (Duplicate Email)');
    const dupRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Another Name', email: testEmail, password: testPassword }),
    });
    const dupData = (await dupRes.json()) as any;
    console.log(`Status: ${dupRes.status}`);
    console.log(`Response:`, dupData);
    if (dupRes.status !== 409) {
      throw new Error(`Expected 409 Conflict for duplicate email but got ${dupRes.status}`);
    }

    // 5. Test Login with Wrong Password
    console.log('\n[Test 5] POST /api/auth/login (Invalid Password)');
    const wrongPassRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'WrongPassword999!' }),
    });
    const wrongPassData = (await wrongPassRes.json()) as any;
    console.log(`Status: ${wrongPassRes.status}`);
    console.log(`Response:`, wrongPassData);
    if (wrongPassRes.status !== 401 || wrongPassData.message !== 'Invalid email or password') {
      throw new Error(`Expected generic 401 error message for wrong password`);
    }

    // 6. Test Login with Non-Existent Email
    console.log('\n[Test 6] POST /api/auth/login (Non-Existent Email)');
    const nonExistentRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com', password: 'SomePassword123' }),
    });
    const nonExistentData = (await nonExistentRes.json()) as any;
    console.log(`Status: ${nonExistentRes.status}`);
    console.log(`Response:`, nonExistentData);
    if (nonExistentRes.status !== 401 || nonExistentData.message !== 'Invalid email or password') {
      throw new Error(`Expected generic 401 error message for non-existent email`);
    }

    // 7. Test Login with Valid Credentials
    console.log('\n[Test 7] POST /api/auth/login (Valid Credentials)');
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    const loginData = (await loginRes.json()) as any;
    console.log(`Status: ${loginRes.status}`);
    console.log(`Response:`, loginData);
    if (loginRes.status !== 200 || !loginData.success) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }

    // Extract rotated session cookie
    const loginCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
    for (const cookieStr of loginCookies) {
      if (cookieStr.startsWith('session_token=')) {
        sessionCookie = cookieStr.split(';')[0];
      }
      if (cookieStr.startsWith('csrf_token=')) {
        csrfCookie = cookieStr.split(';')[0];
        csrfTokenValue = csrfCookie.replace('csrf_token=', '');
      }
    }

    // 8. Test Logout
    console.log('\n[Test 8] POST /api/auth/logout (Authenticated with CSRF)');
    const logoutRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: {
        Cookie: `${sessionCookie}; ${csrfCookie}`,
        'X-CSRF-Token': csrfTokenValue,
      },
    });
    const logoutData = (await logoutRes.json()) as any;
    console.log(`Status: ${logoutRes.status}`);
    console.log(`Response:`, logoutData);
    if (logoutRes.status !== 200 || !logoutData.success) {
      throw new Error(`Logout failed: ${JSON.stringify(logoutData)}`);
    }

    // 9. Verify Session is Revoked after Logout
    console.log('\n[Test 9] GET /api/auth/me after logout');
    const postLogoutMe = await fetch(`${baseUrl}/me`, {
      headers: { Cookie: `${sessionCookie}; ${csrfCookie}` },
    });
    console.log(`Status: ${postLogoutMe.status}`);
    if (postLogoutMe.status !== 401) {
      throw new Error(`Session should be invalid after logout, but got ${postLogoutMe.status}`);
    }

    // 10. Test Session Expiration via Temporal API
    console.log('\n[Test 10] Session Expiration Verification');
    const [testUser] = await db.select().from(users).where(eq(users.email, testEmail));
    if (testUser) {
      const expiredRawToken = 'expired_test_token_1234567890';
      const expiredHash = hashSessionToken(expiredRawToken);
      const expiredIso = '2020-01-01T00:00:00Z';

      await db.insert(authSessions).values({
        userId: testUser.id,
        tokenHash: expiredHash,
        expiresAt: expiredIso,
        createdAt: expiredIso,
        lastActivityAt: expiredIso,
      });

      const expiredCheckRes = await fetch(`${baseUrl}/me`, {
        headers: { Cookie: `session_token=${expiredRawToken}` },
      });
      console.log(`Status for expired session: ${expiredCheckRes.status}`);
      if (expiredCheckRes.status !== 401) {
        throw new Error(`Expected 401 for expired session, got ${expiredCheckRes.status}`);
      }

      // Verify the expired session was purged from the database
      const [remaining] = await db
        .select()
        .from(authSessions)
        .where(eq(authSessions.tokenHash, expiredHash));
      console.log('Expired session cleaned up from database:', !remaining);
    }

    // Clean up test user
    if (testUser) {
      await db.delete(users).where(eq(users.id, testUser.id));
      console.log('Test user cleaned up.');
    }

    console.log('\n--- ALL AUTHENTICATION TESTS PASSED SUCCESSFULLY! ---');
    process.exit(0);
  } finally {
    server.close();
    await pool.end();
  }
}

runAuthTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
