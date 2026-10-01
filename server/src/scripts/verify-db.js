import { pool } from "../config/database.js";

async function verifyIntegrity() {
  const client = await pool.connect();
  console.log("Running Database Integrity & Constraint Verification...\n");

  let passed = 0;
  let total = 0;

  // Test 1: Direct conversation uniqueness
  total++;
  try {
    await client.query(`
      INSERT INTO conversations (type, direct_key, created_by)
      VALUES ('DIRECT', '11111111-1111-1111-1111-111111111111:22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')
    `);
    console.error("FAIL: Duplicate direct conversation was allowed!");
  } catch (err) {
    if (err.code === "23505") { // unique_violation
      console.log("✓ PASS: Direct conversation uniqueness enforced (idx_unique_direct_conversation)");
      passed++;
    } else {
      console.error("FAIL with unexpected error:", err.message);
    }
  }

  // Test 2: Message idempotency
  total++;
  try {
    await client.query(`
      INSERT INTO messages (conversation_id, sender_id, client_message_id, content)
      VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'client-msg-101', 'Duplicate content')
    `);
    console.error("FAIL: Duplicate (sender_id, client_message_id) was allowed!");
  } catch (err) {
    if (err.code === "23505") {
      console.log("✓ PASS: Message idempotency enforced (uq_messages_sender_client_id)");
      passed++;
    } else {
      console.error("FAIL with unexpected error:", err.message);
    }
  }

  // Test 3: Reaction uniqueness
  total++;
  try {
    await client.query(`
      INSERT INTO message_reactions (message_id, user_id, emoji)
      VALUES ('a1000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '👍')
    `);
    console.error("FAIL: Duplicate reaction was allowed!");
  } catch (err) {
    if (err.code === "23505") {
      console.log("✓ PASS: Reaction uniqueness enforced (PRIMARY KEY)");
      passed++;
    } else {
      console.error("FAIL with unexpected error:", err.message);
    }
  }

  // Test 4: Receipt uniqueness
  total++;
  try {
    await client.query(`
      INSERT INTO message_receipts (message_id, user_id)
      VALUES ('a3000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222')
    `);
    console.error("FAIL: Duplicate receipt was allowed!");
  } catch (err) {
    if (err.code === "23505") {
      console.log("✓ PASS: Receipt uniqueness enforced (PRIMARY KEY)");
      passed++;
    } else {
      console.error("FAIL with unexpected error:", err.message);
    }
  }

  // Test 5: Foreign key cascade on user delete
  total++;
  try {
    await client.query("BEGIN");
    // Create temporary test user
    const res = await client.query(`
      INSERT INTO users (email, password_hash, name)
      VALUES ('test_cascade@example.com', 'dummy', 'Test Cascade')
      RETURNING id
    `);
    const tempId = res.rows[0].id;
    await client.query(`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, 'dummy_hash', NOW() + INTERVAL '1 day')
    `, [tempId]);

    // Delete user
    await client.query("DELETE FROM users WHERE id = $1", [tempId]);
    const tokenCheck = await client.query("SELECT * FROM refresh_tokens WHERE user_id = $1", [tempId]);
    if (tokenCheck.rows.length === 0) {
      console.log("✓ PASS: Foreign key ON DELETE CASCADE verified");
      passed++;
    } else {
      console.error("FAIL: Dependent token not deleted!");
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("FAIL in cascade test:", err.message);
  }

  console.log(`\nIntegrity Verification Completed: ${passed}/${total} checks passed.`);
  client.release();
  await pool.end();
}

verifyIntegrity().catch((err) => {
  console.error("Verification script error:", err);
  process.exit(1);
});
