import { pool } from "../config/database.js";
import * as userService from "../services/user.service.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";

async function verifyUserSearch() {
  console.log("Starting Module 3 User Search Verification...\n");
  let passed = 0;
  let total = 0;

  // Grab seed users for testing
  const { rows: users } = await pool.query("SELECT id, email, name FROM users ORDER BY name ASC, id ASC");
  if (users.length < 2) {
    throw new Error("Seed users missing. Run npm run seed first.");
  }

  const currentUser = users[0]; // e.g. Alice
  const otherUser = users[1];   // e.g. Bob

  // Test 1: Blank query returns empty list
  total++;
  try {
    const res = await userService.searchUsers({
      currentUserId: currentUser.id,
      query: "   ",
      limit: 20,
    });
    if (res.users.length === 0 && res.nextCursor === null) {
      console.log("✓ PASS: Blank query returns empty array without error");
      passed++;
    } else {
      console.error("FAIL: Blank query did not return empty array:", res);
    }
  } catch (err) {
    console.error("FAIL in blank query test:", err.message);
  }

  // Test 2: Current user exclusion & safe fields
  total++;
  try {
    const res = await userService.searchUsers({
      currentUserId: currentUser.id,
      query: currentUser.name.slice(0, 3), // Search part of caller's name
      limit: 20,
    });

    const foundCurrent = res.users.some((u) => u.id === currentUser.id);
    const hasSensitiveFields = res.users.some(
      (u) => "password_hash" in u || "password" in u || "token_hash" in u
    );

    if (!foundCurrent && !hasSensitiveFields) {
      console.log("✓ PASS: Caller is strictly excluded and only safe fields are exposed");
      passed++;
    } else {
      console.error("FAIL: Current user found or sensitive fields leaked!", { foundCurrent, hasSensitiveFields });
    }
  } catch (err) {
    console.error("FAIL in exclusion test:", err.message);
  }

  // Test 3: Matching other users
  total++;
  try {
    const res = await userService.searchUsers({
      currentUserId: currentUser.id,
      query: otherUser.name.slice(0, 3),
      limit: 20,
    });

    const foundTarget = res.users.some((u) => u.id === otherUser.id);
    if (foundTarget) {
      console.log(`✓ PASS: Found other user "${otherUser.name}" successfully`);
      passed++;
    } else {
      console.error("FAIL: Could not find target user in search:", res.users);
    }
  } catch (err) {
    console.error("FAIL in search matching test:", err.message);
  }

  // Test 4: Cursor pagination
  total++;
  try {
    // Search with limit=1 to force pagination
    const page1 = await userService.searchUsers({
      currentUserId: currentUser.id,
      query: "example.com", // Matches all seed users
      limit: 1,
    });

    if (page1.users.length === 1 && page1.nextCursor) {
      const page2 = await userService.searchUsers({
        currentUserId: currentUser.id,
        query: "example.com",
        limit: 1,
        cursor: page1.nextCursor,
      });

      if (page2.users.length === 1 && page2.users[0].id !== page1.users[0].id) {
        console.log("✓ PASS: Cursor pagination correctly pages sequentially without duplicate records");
        passed++;
      } else {
        console.error("FAIL: Page 2 did not return distinct subsequent user:", { page1, page2 });
      }
    } else {
      console.error("FAIL: Page 1 did not return expected limit 1 or nextCursor:", page1);
    }
  } catch (err) {
    console.error("FAIL in pagination test:", err.message);
  }

  // Test 5: Invalid cursor rejection
  total++;
  try {
    await userService.searchUsers({
      currentUserId: currentUser.id,
      query: "alice",
      cursor: "invalid-base64url-gibberish!!!",
    });
    console.error("FAIL: Invalid cursor was accepted!");
  } catch (err) {
    if (err.message === "INVALID_CURSOR") {
      console.log("✓ PASS: Invalid cursor rejected with INVALID_CURSOR");
      passed++;
    } else {
      console.error("FAIL with unexpected error:", err);
    }
  }

  // Test 6: SQL injection resiliency
  total++;
  try {
    const res = await userService.searchUsers({
      currentUserId: currentUser.id,
      query: "' OR 1=1 --",
      limit: 20,
    });
    // Should safely treat as string and match 0 users
    if (res.users.length === 0) {
      console.log("✓ PASS: SQL injection attempts treated safely as literal search text");
      passed++;
    } else {
      console.error("FAIL: SQL injection returned unexpected records:", res);
    }
  } catch (err) {
    console.error("FAIL in SQL injection test:", err.message);
  }

  console.log(`\nUser Search Verification Completed: ${passed}/${total} checks passed.`);
  await pool.end();
}

verifyUserSearch().catch((err) => {
  console.error("Verification script error:", err);
  process.exit(1);
});
