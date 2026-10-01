import { pool } from "../config/database.js";
import * as conversationService from "../services/conversation.service.js";

async function verifyConversations() {
  console.log("Starting Module 4 Conversations Verification...\n");
  let passed = 0;
  let total = 0;

  // Grab seed users
  const { rows: users } = await pool.query("SELECT id, name, email FROM users ORDER BY email ASC");
  if (users.length < 3) {
    throw new Error("Seed users missing. Run npm run seed first.");
  }

  const alice = users.find((u) => u.email.startsWith("alice"));
  const bob = users.find((u) => u.email.startsWith("bob"));
  const charlie = users.find((u) => u.email.startsWith("charlie"));
  const fiona = users.find((u) => u.email.startsWith("fiona"));

  let directConvId;

  // Test 1: Direct conversation creation
  total++;
  try {
    const conv = await conversationService.getOrCreateDirectConversation({
      currentUserId: alice.id,
      targetUserId: bob.id,
    });

    if (conv.id && conv.type === "DIRECT" && conv.otherUser?.id === bob.id) {
      directConvId = conv.id;
      console.log(`✓ PASS: Direct conversation created/retrieved between Alice and Bob (${conv.id})`);
      passed++;
    } else {
      console.error("FAIL in direct conversation payload:", conv);
    }
  } catch (err) {
    console.error("FAIL in create direct conversation:", err.message);
  }

  // Test 2: Idempotent creation (Alice -> Bob again)
  total++;
  try {
    const convAgain = await conversationService.getOrCreateDirectConversation({
      currentUserId: alice.id,
      targetUserId: bob.id,
    });

    if (convAgain.id === directConvId) {
      console.log("✓ PASS: Subsequent creation returns identical conversation ID");
      passed++;
    } else {
      console.error("FAIL: Duplicate conversation ID returned:", { directConvId, newId: convAgain.id });
    }
  } catch (err) {
    console.error("FAIL in idempotent test:", err.message);
  }

  // Test 3: Bidirectional reverse creation (Bob -> Alice)
  total++;
  try {
    const reverseConv = await conversationService.getOrCreateDirectConversation({
      currentUserId: bob.id,
      targetUserId: alice.id,
    });

    if (reverseConv.id === directConvId && reverseConv.otherUser?.id === alice.id) {
      console.log("✓ PASS: Reverse initiation (Bob -> Alice) resolves to identical conversation ID and correctly sets otherUser");
      passed++;
    } else {
      console.error("FAIL in reverse creation:", reverseConv);
    }
  } catch (err) {
    console.error("FAIL in reverse creation test:", err.message);
  }

  // Test 4: Self-conversation rejection
  total++;
  try {
    await conversationService.getOrCreateDirectConversation({
      currentUserId: alice.id,
      targetUserId: alice.id,
    });
    console.error("FAIL: Self-conversation was permitted!");
  } catch (err) {
    if (err.code === "SELF_CONVERSATION_NOT_ALLOWED") {
      console.log("✓ PASS: Self-conversation rejected with SELF_CONVERSATION_NOT_ALLOWED");
      passed++;
    } else {
      console.error("FAIL with unexpected error code:", err);
    }
  }

  // Test 5: Unknown target user rejection
  total++;
  try {
    await conversationService.getOrCreateDirectConversation({
      currentUserId: alice.id,
      targetUserId: "00000000-0000-0000-0000-000000000000",
    });
    console.error("FAIL: Non-existent target user was permitted!");
  } catch (err) {
    if (err.code === "USER_NOT_FOUND") {
      console.log("✓ PASS: Non-existent user rejected with USER_NOT_FOUND");
      passed++;
    } else {
      console.error("FAIL with unexpected error code:", err);
    }
  }

  // Test 6: Access control (Membership authorization)
  total++;
  try {
    // Alice is a member
    const aliceView = await conversationService.getConversation({
      conversationId: directConvId,
      userId: alice.id,
    });

    // Fiona is NOT a member of Alice & Bob direct chat
    const fionaView = await conversationService.getConversation({
      conversationId: directConvId,
      userId: fiona.id,
    });

    if (aliceView && aliceView.id === directConvId && fionaView === null) {
      console.log("✓ PASS: Conversation access control strictly enforced (non-member receives null)");
      passed++;
    } else {
      console.error("FAIL in access control test:", { aliceView, fionaView });
    }
  } catch (err) {
    console.error("FAIL in access control test:", err.message);
  }

  // Test 7: List conversations
  total++;
  try {
    const convs = await conversationService.listConversations(alice.id);
    const hasDirect = convs.some((c) => c.id === directConvId);
    if (hasDirect && convs.length > 0) {
      console.log(`✓ PASS: Conversation listing retrieved ${convs.length} active conversations for Alice`);
      passed++;
    } else {
      console.error("FAIL in listing conversations:", convs);
    }
  } catch (err) {
    console.error("FAIL in list conversations test:", err.message);
  }

  // Test 8: Concurrent creation race condition safety
  total++;
  try {
    // Pick two users without existing direct chat, e.g. Diana & Ethan
    const diana = users.find((u) => u.email.startsWith("diana"));
    const ethan = users.find((u) => u.email.startsWith("ethan"));

    const promises = [
      conversationService.getOrCreateDirectConversation({ currentUserId: diana.id, targetUserId: ethan.id }),
      conversationService.getOrCreateDirectConversation({ currentUserId: ethan.id, targetUserId: diana.id }),
      conversationService.getOrCreateDirectConversation({ currentUserId: diana.id, targetUserId: ethan.id }),
      conversationService.getOrCreateDirectConversation({ currentUserId: ethan.id, targetUserId: diana.id }),
    ];

    const results = await Promise.all(promises);
    const firstId = results[0].id;
    const allSame = results.every((r) => r.id === firstId);

    if (allSame) {
      console.log("✓ PASS: Concurrent creation race resolved cleanly to single conversation ID");
      passed++;
    } else {
      console.error("FAIL: Multiple conversation IDs generated under concurrency:", results);
    }
  } catch (err) {
    console.error("FAIL in concurrency test:", err.message);
  }

  console.log(`\nConversations Verification Completed: ${passed}/${total} checks passed.`);
  await pool.end();
}

verifyConversations().catch((err) => {
  console.error("Conversations test error:", err);
  process.exit(1);
});
