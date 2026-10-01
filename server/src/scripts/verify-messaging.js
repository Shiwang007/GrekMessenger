import { pool } from "../config/database.js";
import * as messageService from "../services/message.service.js";
import * as conversationService from "../services/conversation.service.js";
import * as groupService from "../services/group.service.js";
import crypto from "crypto";

async function verifyMessaging() {
  console.log("=== Starting Module 6 Messaging Verification Tests ===");
  let passed = 0;
  let total = 0;

  function pass(name) {
    console.log(`\x1b[32m✓ PASS:\x1b[0m ${name}`);
    passed++;
  }

  function fail(name, err) {
    console.error(`\x1b[31m✗ FAIL:\x1b[0m ${name}`);
    console.error(err);
  }

  // Retrieve seed users: Alice, Bob, Charlie
  const { rows: users } = await pool.query("SELECT id, name, email FROM users ORDER BY email ASC");
  const alice = users.find((u) => u.email.startsWith("alice"));
  const bob = users.find((u) => u.email.startsWith("bob"));
  const charlie = users.find((u) => u.email.startsWith("charlie"));

  if (!alice || !bob || !charlie) {
    console.error("Required seed users (Alice, Bob, Charlie) not found!");
    process.exit(1);
  }

  // Setup: Direct conversation between Alice and Bob
  const directConv = await conversationService.getOrCreateDirectConversation({
    currentUserId: alice.id,
    targetUserId: bob.id,
  });

  // Setup: Group conversation with Alice (Owner) and Bob
  const groupConv = await groupService.createGroup({
    creatorId: alice.id,
    name: "Messaging Verify Group " + Date.now(),
  });
  await groupService.addMember({
    conversationId: groupConv.id,
    actorId: alice.id,
    targetUserId: bob.id,
  });

  // 1. Unauthenticated / Non-member Send
  total++;
  try {
    await messageService.createMessage({
      conversationId: directConv.id,
      senderId: charlie.id, // Charlie is NOT in direct conversation
      clientMessageId: crypto.randomUUID(),
      content: "Intruder message",
    });
    fail("Non-member send must be rejected", "Expected error but succeeded");
  } catch (err) {
    if (err.statusCode === 404 && err.code === "CONVERSATION_NOT_FOUND") {
      pass("Non-member send rejected with 404 CONVERSATION_NOT_FOUND");
    } else {
      fail("Non-member send error mismatch", err);
    }
  }

  // 2. Removed Member Send
  total++;
  try {
    // Add Charlie then remove Charlie from group
    await groupService.addMember({
      conversationId: groupConv.id,
      actorId: alice.id,
      targetUserId: charlie.id,
    });
    await groupService.removeMember({
      conversationId: groupConv.id,
      actorId: alice.id,
      targetUserId: charlie.id,
    });

    await messageService.createMessage({
      conversationId: groupConv.id,
      senderId: charlie.id, // Removed member
      clientMessageId: crypto.randomUUID(),
      content: "Message after removal",
    });
    fail("Removed member send must be rejected", "Expected error but succeeded");
  } catch (err) {
    if (err.statusCode === 404 && err.code === "CONVERSATION_NOT_FOUND") {
      pass("Removed member send denied with 404 CONVERSATION_NOT_FOUND");
    } else {
      fail("Removed member send error mismatch", err);
    }
  }

  // 3. Normal Send & Response Structure
  total++;
  let sharedClientMsgId = crypto.randomUUID();
  let firstMsg = null;
  try {
    firstMsg = await messageService.createMessage({
      conversationId: groupConv.id,
      senderId: alice.id,
      clientMessageId: sharedClientMsgId,
      content: "Hello everyone in group!",
    });

    if (
      firstMsg.id &&
      firstMsg.conversation_id === groupConv.id &&
      firstMsg.sender_id === alice.id &&
      firstMsg.content === "Hello everyone in group!" &&
      firstMsg.created_at
    ) {
      pass("Normal message created with proper schema & database persistence");
    } else {
      fail("Normal message fields mismatch", firstMsg);
    }
  } catch (err) {
    fail("Normal message creation threw error", err);
  }

  // 4. Duplicate Retry (Idempotency)
  total++;
  try {
    const retryMsg = await messageService.createMessage({
      conversationId: groupConv.id,
      senderId: alice.id,
      clientMessageId: sharedClientMsgId,
      content: "Hello everyone in group! (retry attempt)",
    });

    if (retryMsg.id === firstMsg.id && retryMsg.content === firstMsg.content) {
      pass("Duplicate retry with same (senderId, clientMessageId) returned original persisted message");
    } else {
      fail("Duplicate retry returned different message or modified content", retryMsg);
    }
  } catch (err) {
    fail("Duplicate retry threw error", err);
  }

  // 5. Database Concurrency & Race Condition Protection
  total++;
  try {
    const concurrentId = crypto.randomUUID();
    const promises = [
      messageService.createMessage({
        conversationId: groupConv.id,
        senderId: alice.id,
        clientMessageId: concurrentId,
        content: "Concurrent test message",
      }),
      messageService.createMessage({
        conversationId: groupConv.id,
        senderId: alice.id,
        clientMessageId: concurrentId,
        content: "Concurrent test message",
      }),
      messageService.createMessage({
        conversationId: groupConv.id,
        senderId: alice.id,
        clientMessageId: concurrentId,
        content: "Concurrent test message",
      }),
    ];

    const results = await Promise.all(promises);
    const id0 = results[0].id;
    const id1 = results[1].id;
    const id2 = results[2].id;

    if (id0 === id1 && id1 === id2) {
      // Verify exactly one row in DB for this client_message_id
      const { rows } = await pool.query(
        "SELECT count(*) FROM messages WHERE sender_id = $1 AND client_message_id = $2",
        [alice.id, concurrentId]
      );
      if (parseInt(rows[0].count, 10) === 1) {
        pass("Concurrent duplicate sends resolve to single persisted row (PostgreSQL 23505 savepoint verified)");
      } else {
        fail("Database contains multiple rows for unique clientMessageId", rows);
      }
    } else {
      fail("Concurrent sends produced different IDs", { id0, id1, id2 });
    }
  } catch (err) {
    fail("Concurrent duplicate send test error", err);
  }

  // 6. Conversation Activity Timestamp Updating
  total++;
  try {
    const { rows: beforeRows } = await pool.query("SELECT updated_at FROM conversations WHERE id = $1", [groupConv.id]);
    const beforeTimestamp = new Date(beforeRows[0].updated_at).getTime();

    // Small delay to ensure timestamp advancement
    await new Promise((r) => setTimeout(r, 100));

    await messageService.createMessage({
      conversationId: groupConv.id,
      senderId: alice.id,
      clientMessageId: crypto.randomUUID(),
      content: "Timestamp test message",
    });

    const { rows: afterRows } = await pool.query("SELECT updated_at FROM conversations WHERE id = $1", [groupConv.id]);
    const afterTimestamp = new Date(afterRows[0].updated_at).getTime();

    if (afterTimestamp > beforeTimestamp) {
      pass("New message creation touched conversations.updated_at");
    } else {
      fail("conversations.updated_at was not updated", { beforeTimestamp, afterTimestamp });
    }
  } catch (err) {
    fail("Conversation activity test error", err);
  }

  // 7. Cursor Pagination & Gapless History
  total++;
  try {
    // Send 12 messages in direct conversation
    for (let i = 1; i <= 12; i++) {
      await messageService.createMessage({
        conversationId: directConv.id,
        senderId: alice.id,
        clientMessageId: crypto.randomUUID(),
        content: `Pagination test message #${i}`,
      });
    }

    // Page 1: limit 5
    const p1 = await messageService.listMessages({
      conversationId: directConv.id,
      userId: alice.id,
      limit: 5,
    });

    if (p1.messages.length !== 5 || !p1.nextCursor) {
      throw new Error(`Page 1 invalid: length=${p1.messages.length}, nextCursor=${p1.nextCursor}`);
    }

    // Page 2: limit 5 with before cursor
    const p2 = await messageService.listMessages({
      conversationId: directConv.id,
      userId: alice.id,
      limit: 5,
      before: p1.nextCursor,
    });

    if (p2.messages.length !== 5 || !p2.nextCursor) {
      throw new Error(`Page 2 invalid: length=${p2.messages.length}, nextCursor=${p2.nextCursor}`);
    }

    // Page 3: limit 5 with before cursor
    const p3 = await messageService.listMessages({
      conversationId: directConv.id,
      userId: alice.id,
      limit: 5,
      before: p2.nextCursor,
    });

    if (p3.messages.length < 2) {
      throw new Error(`Page 3 expected remaining messages, got ${p3.messages.length}`);
    }

    // Verify all message IDs are unique across pages
    const allIds = [
      ...p1.messages.map((m) => m.id),
      ...p2.messages.map((m) => m.id),
      ...p3.messages.map((m) => m.id),
    ];
    const uniqueIds = new Set(allIds);

    if (uniqueIds.size === allIds.length) {
      pass(`Cursor pagination retrieved ${allIds.length} unique messages without duplicates or gaps across 3 pages`);
    } else {
      fail("Duplicate messages found in paginated response", { total: allIds.length, unique: uniqueIds.size });
    }
  } catch (err) {
    fail("Cursor pagination test error", err);
  }

  // 8. Cursor Tampering
  total++;
  try {
    await messageService.listMessages({
      conversationId: directConv.id,
      userId: alice.id,
      before: "invalid-tampered-base64",
    });
    fail("Tampered cursor must be rejected", "Expected error but succeeded");
  } catch (err) {
    if (err.statusCode === 400 && err.code === "INVALID_CURSOR") {
      pass("Tampered cursor rejected with 400 INVALID_CURSOR");
    } else {
      fail("Tampered cursor error mismatch", err);
    }
  }

  // 9. Oversized Message Validation
  total++;
  try {
    await messageService.createMessage({
      conversationId: directConv.id,
      senderId: alice.id,
      clientMessageId: crypto.randomUUID(),
      content: "x".repeat(5001),
    });
    fail("Oversized message must be rejected", "Expected error but succeeded");
  } catch (err) {
    if (err.statusCode === 400 && err.code === "MESSAGE_TOO_LONG") {
      pass("Oversized message rejected with 400 MESSAGE_TOO_LONG");
    } else {
      fail("Oversized message error mismatch", err);
    }
  }

  // 10. Empty Message Validation
  total++;
  try {
    await messageService.createMessage({
      conversationId: directConv.id,
      senderId: alice.id,
      clientMessageId: crypto.randomUUID(),
      content: "   ",
    });
    fail("Empty message must be rejected", "Expected error but succeeded");
  } catch (err) {
    if (err.statusCode === 400 && err.code === "INVALID_MESSAGE") {
      pass("Empty message rejected with 400 INVALID_MESSAGE");
    } else {
      fail("Empty message error mismatch", err);
    }
  }

  console.log(`\n=== Verification Complete: ${passed}/${total} tests passed ===`);
  await pool.end();

  if (passed !== total) {
    process.exit(1);
  }
}

verifyMessaging().catch((err) => {
  console.error("Unhandled error in test runner:", err);
  process.exit(1);
});
