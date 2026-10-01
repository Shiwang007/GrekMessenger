import * as authService from "../services/auth.service.js";
import { pool } from "../config/database.js";
import { generateAccessToken, verifyAccessToken } from "../utils/jwt.js";

async function verifyAuth() {
  console.log("Starting Module 2 Authentication Verification...\n");
  let passed = 0;
  let total = 0;

  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = "ValidPassword123!";
  const testName = "Auth Tester";

  // Test 1: Signup
  total++;
  try {
    const user = await authService.signup({
      name: testName,
      email: testEmail,
      password: testPassword,
    });
    if (user.id && user.email === testEmail.toLowerCase() && !user.password_hash) {
      console.log("✓ PASS: Signup creates user and returns sanitized payload");
      passed++;
    } else {
      console.error("FAIL in signup payload:", user);
    }
  } catch (err) {
    console.error("FAIL in signup:", err.message);
  }

  // Test 2: Duplicate signup
  total++;
  try {
    await authService.signup({
      name: testName,
      email: testEmail,
      password: testPassword,
    });
    console.error("FAIL: Duplicate signup was allowed!");
  } catch (err) {
    if (err.statusCode === 409) {
      console.log("✓ PASS: Duplicate signup rejected with 409");
      passed++;
    } else {
      console.error("FAIL with unexpected status:", err);
    }
  }

  // Test 3: Invalid login
  total++;
  try {
    await authService.login({
      email: testEmail,
      password: "WrongPassword!",
    });
    console.error("FAIL: Invalid password login was allowed!");
  } catch (err) {
    if (err.statusCode === 401) {
      console.log("✓ PASS: Invalid login rejected with 401");
      passed++;
    } else {
      console.error("FAIL with unexpected error:", err);
    }
  }

  // Test 4: Valid login
  total++;
  let loginResult;
  try {
    loginResult = await authService.login({
      email: testEmail,
      password: testPassword,
    });
    if (loginResult.accessToken && loginResult.refreshToken && loginResult.user) {
      const payload = verifyAccessToken(loginResult.accessToken);
      if (payload.sub === loginResult.user.id) {
        console.log("✓ PASS: Valid login returns JWT access token and refresh token");
        passed++;
      }
    }
  } catch (err) {
    console.error("FAIL in login:", err.message);
  }

  // Test 5: Refresh token rotation
  total++;
  let refreshResult;
  try {
    refreshResult = await authService.refreshSession(loginResult.refreshToken);
    if (refreshResult.accessToken && refreshResult.refreshToken !== loginResult.refreshToken) {
      console.log("✓ PASS: Refresh token rotation issues new access token & rotates refresh token");
      passed++;
    } else {
      console.error("FAIL in token rotation:", refreshResult);
    }
  } catch (err) {
    console.error("FAIL in refresh session:", err.message);
  }

  // Test 6: Reusing old refresh token must fail
  total++;
  try {
    await authService.refreshSession(loginResult.refreshToken);
    console.error("FAIL: Revoked refresh token was accepted!");
  } catch (err) {
    if (err.statusCode === 401) {
      console.log("✓ PASS: Revoked refresh token properly rejected with 401");
      passed++;
    } else {
      console.error("FAIL with unexpected error:", err);
    }
  }

  // Test 7: Get current user (/me)
  total++;
  try {
    const me = await authService.getCurrentUser(loginResult.user.id);
    if (me.id === loginResult.user.id && !me.password_hash) {
      console.log("✓ PASS: Current user retrieved and sanitized");
      passed++;
    }
  } catch (err) {
    console.error("FAIL in getCurrentUser:", err.message);
  }

  // Test 8: Logout revokes refresh token
  total++;
  try {
    await authService.logout(refreshResult.refreshToken);
    try {
      await authService.refreshSession(refreshResult.refreshToken);
      console.error("FAIL: Logged out refresh token was accepted!");
    } catch (err) {
      if (err.statusCode === 401) {
        console.log("✓ PASS: Logout revokes refresh token successfully");
        passed++;
      }
    }
  } catch (err) {
    console.error("FAIL in logout:", err.message);
  }

  // Cleanup test user
  try {
    await pool.query("DELETE FROM users WHERE email = $1", [testEmail.toLowerCase()]);
  } catch {}

  console.log(`\nAuthentication Verification Completed: ${passed}/${total} checks passed.`);
  await pool.end();
}

verifyAuth().catch((err) => {
  console.error("Auth test error:", err);
  process.exit(1);
});
