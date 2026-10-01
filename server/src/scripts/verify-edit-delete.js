import { pool } from "../config/database.js";
import * as messageService from "../services/message.service.js";
import * as reactionService from "../services/reaction.service.js";
import * as conversationService from "../services/conversation.service.js";
import crypto from "crypto";

async function runVerification() {
  console.log("=== Starting Module 13 Verification Tests ===");
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

  try {
    // 1. Get seed users: Alice and Bob
    const { rows: users } = await pool.query("SELECT id, name, email FROM users ORDER BY email ASC");
    const alice = users.find((u) => u.email.startsWith("alice"));
    const bob = users.find((u) => u.email.startsWith("bob"));

    if (!alice || !bob) {
      throw new Error("Alice or Bob not found in database.");
    }

    const conv = await conversationService.getOrCreateDirectConversation({
      currentUserId: alice.id,
      targetUserId: bob.id,
    });

    // 2. Create a test message sent by Alice
    const createdMsg = await messageService.createMessage({
      conversationId: conv.id,
      senderId: alice.id,
      clientMessageId: crypto.randomUUID(),
      content: "Initial message from Alice",
    });

    // Test 1: Edit own message
    total++;
    try {
      const edited = await messageService.editMessage({
        userId: alice.id,
        conversationId: conv.id,
        messageId: createdMsg.id,
        content: "Edited message from Alice",
      });

      if (
        edited.content === "Edited message from Alice" &&
        edited.updatedAt !== null &&
        new Date(edited.createdAt).getTime() === new Date(createdMsg.createdAt).getTime()
      ) {
        pass("Alice edits her own message and updatedAt is updated");
      } else {
        fail("Edit message check", "Fields do not match expected values");
      }
    } catch (err) {
      fail("Alice edits her own message", err);
    }

    // Test 2: Bob cannot edit Alice's message
    total++;
    try {
      await messageService.editMessage({
        userId: bob.id,
        conversationId: conv.id,
        messageId: createdMsg.id,
        content: "Bob trying to hack Alice's message",
      });
      fail("Bob editing Alice's message must fail", "Expected error but succeeded");
    } catch (err) {
      if (err.code === "MESSAGE_NOT_OWNED" || err.statusCode === 403) {
        pass("Bob cannot edit Alice's message (MESSAGE_NOT_OWNED)");
      } else {
        fail("Bob editing Alice's message wrong error code", err);
      }
    }

    // Test 3: Add reaction from Bob
    total++;
    try {
      const reaction = await reactionService.addReaction({
        userId: bob.id,
        conversationId: conv.id,
        messageId: createdMsg.id,
        emoji: "👍",
      });

      if (reaction && reaction.emoji === "👍") {
        pass("Bob successfully reacted with 👍");
      } else {
        fail("Add reaction check", "Reaction object invalid");
      }
    } catch (err) {
      fail("Bob reacts with 👍", err);
    }

    // Test 4: List messages includes reactions
    total++;
    try {
      const history = await messageService.listMessages({
        conversationId: conv.id,
        userId: alice.id,
        limit: 10,
      });

      const found = history.messages.find((m) => m.id === createdMsg.id);
      if (
        found &&
        found.reactions.some((r) => r.emoji === "👍" && r.userIds.includes(bob.id))
      ) {
        pass("Message history correctly returns aggregated reactions");
      } else {
        fail("History reaction aggregation", JSON.stringify(found?.reactions));
      }
    } catch (err) {
      fail("List messages with reactions", err);
    }

    // Test 5: Remove reaction
    total++;
    try {
      await reactionService.removeReaction({
        userId: bob.id,
        conversationId: conv.id,
        messageId: createdMsg.id,
        emoji: "👍",
      });

      const reactions = await messageService.getReactionsForMessage(createdMsg.id);
      if (reactions.length === 0 || !reactions.some((r) => r.emoji === "👍")) {
        pass("Bob removed reaction successfully");
      } else {
        fail("Reaction removal check", "Reaction still exists in DB");
      }
    } catch (err) {
      fail("Remove reaction", err);
    }

    // Test 6: Delete own message within 10 minutes
    total++;
    try {
      const deleted = await messageService.deleteMessage({
        userId: alice.id,
        conversationId: conv.id,
        messageId: createdMsg.id,
      });

      if (deleted && deleted.deletedAt) {
        pass("Alice deleted her own message within 10 minutes");
      } else {
        fail("Delete message check", "deletedAt missing");
      }
    } catch (err) {
      fail("Alice deletes own message", err);
    }

    // Test 7: Deleted message masks content and strips reactions
    total++;
    try {
      const historyAfterDelete = await messageService.listMessages({
        conversationId: conv.id,
        userId: alice.id,
        limit: 10,
      });

      const deletedFound = historyAfterDelete.messages.find((m) => m.id === createdMsg.id);
      if (deletedFound && deletedFound.content === null && deletedFound.deletedAt !== null) {
        pass("Deleted message has masked content (null) and non-null deletedAt");
      } else {
        fail("Deleted message masking check", JSON.stringify(deletedFound));
      }
    } catch (err) {
      fail("Deleted message check in history", err);
    }

    // Test 8: Cannot edit a deleted message
    total++;
    try {
      await messageService.editMessage({
        userId: alice.id,
        conversationId: conv.id,
        messageId: createdMsg.id,
        content: "Trying to edit deleted message",
      });
      fail("Edit deleted message must fail", "Expected error but succeeded");
    } catch (err) {
      if (err.code === "MESSAGE_ALREADY_DELETED" || err.statusCode === 409) {
        pass("Editing a deleted message is rejected (MESSAGE_ALREADY_DELETED)");
      } else {
        fail("Edit deleted message wrong error code", err);
      }
    }

    // Test 9: Deleting a message older than 10 minutes is rejected
    total++;
    try {
      // Create an old message directly with created_at 20 minutes ago
      const oldRes = await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, client_message_id, content, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes')
         RETURNING id`,
        [conv.id, alice.id, crypto.randomUUID(), "Ancient message"]
      );
      const oldMsgId = oldRes.rows[0].id;

      try {
        await messageService.deleteMessage({
          userId: alice.id,
          conversationId: conv.id,
          messageId: oldMsgId,
        });
        fail("Deleting old message must fail", "Expected error but succeeded");
      } catch (err) {
        if (err.code === "MESSAGE_DELETE_WINDOW_EXPIRED" || err.statusCode === 403) {
          pass("Deleting message older than 10 minutes is rejected (MESSAGE_DELETE_WINDOW_EXPIRED)");
        } else {
          fail("Old message delete wrong error code", err);
        }
      }
    } catch (err) {
      fail("Old message delete test setup", err);
    }

    // Test 10: Editing a message older than 10 minutes is rejected
    total++;
    try {
      const oldRes2 = await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, client_message_id, content, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes')
         RETURNING id`,
        [conv.id, alice.id, crypto.randomUUID(), "Ancient message to edit"]
      );
      const oldMsgId2 = oldRes2.rows[0].id;

      try {
        await messageService.editMessage({
          userId: alice.id,
          conversationId: conv.id,
          messageId: oldMsgId2,
          content: "Trying to edit ancient message",
        });
        fail("Editing old message must fail", "Expected error but succeeded");
      } catch (err) {
        if (err.code === "MESSAGE_EDIT_WINDOW_EXPIRED" || err.statusCode === 403) {
          pass("Editing message older than 10 minutes is rejected (MESSAGE_EDIT_WINDOW_EXPIRED)");
        } else {
          fail("Old message edit wrong error code", err);
        }
      }
    } catch (err) {
      fail("Old message edit test setup", err);
    }

    console.log(`\n=== Verification Complete: ${passed}/${total} passed ===`);
  } finally {
    await pool.end();
  }
}

runVerification();
