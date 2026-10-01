import "dotenv/config";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../config/database.js";
import * as conversationService from "../services/conversation.service.js";
import * as groupService from "../services/group.service.js";
import { io as ClientIO } from "../../../client/node_modules/socket.io-client/build/esm/index.js";

const SOCKET_URL = process.env.SERVER_URL?.replace(/\/api\/?$/, "") || "http://localhost:5000";

function createToken(userId, type = "access", secret = process.env.JWT_ACCESS_SECRET, expiresIn = "15m") {
  return jwt.sign({ sub: userId, type }, secret, { expiresIn });
}

function connectSocket(auth = {}) {
  return ClientIO(SOCKET_URL, {
    auth,
    transports: ["websocket"],
    reconnection: false,
    timeout: 5000,
  });
}

async function verifyRealtimeMessaging() {
  console.log("=== Starting Module 8 Real-Time Messaging Verification Tests ===");
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

  // 1. Retrieve seed users: Alice, Bob, Charlie
  const { rows: users } = await pool.query("SELECT id, name, email FROM users ORDER BY email ASC");
  const alice = users.find((u) => u.email.startsWith("alice"));
  const bob = users.find((u) => u.email.startsWith("bob"));
  const charlie = users.find((u) => u.email.startsWith("charlie"));

  if (!alice || !bob || !charlie) {
    console.error("Required seed users (Alice, Bob, Charlie) not found!");
    process.exit(1);
  }

  // Set up test direct conversation between Alice and Bob
  const directConv = await conversationService.getOrCreateDirectConversation({
    currentUserId: alice.id,
    targetUserId: bob.id,
  });

  // Set up test group conversation
  const groupConv = await groupService.createGroup({
    creatorId: alice.id,
    name: "Realtime Test Group " + Date.now(),
  });
  await groupService.addMember({
    conversationId: groupConv.id,
    actorId: alice.id,
    targetUserId: bob.id,
  });

  // Connect sockets for Alice, Bob, Charlie
  const aliceSocket = connectSocket({ token: createToken(alice.id) });
  const bobSocket = connectSocket({ token: createToken(bob.id) });
  const charlieSocket = connectSocket({ token: createToken(charlie.id) });

  await Promise.all([
    new Promise((resolve) => aliceSocket.on("connect", resolve)),
    new Promise((resolve) => bobSocket.on("connect", resolve)),
    new Promise((resolve) => charlieSocket.on("connect", resolve)),
  ]);

  // Join Alice & Bob to groupConv room
  await Promise.all([
    new Promise((resolve) => aliceSocket.emit("conversation:join", { conversationId: groupConv.id }, resolve)),
    new Promise((resolve) => bobSocket.emit("conversation:join", { conversationId: groupConv.id }, resolve)),
  ]);

  // TEST 1: Reject message:send for non-member
  total++;
  await new Promise((resolve) => {
    // Charlie tries to send to groupConv without membership
    charlieSocket.emit(
      "message:send",
      {
        conversationId: groupConv.id,
        clientMessageId: crypto.randomUUID(),
        content: "I am not a member!",
      },
      (res) => {
        if (!res?.ok && res?.code === "CONVERSATION_ACCESS_DENIED") {
          pass("1. Non-member send rejected with CONVERSATION_ACCESS_DENIED");
        } else {
          fail("1. Non-member send rejection failed", res);
        }
        resolve();
      }
    );
  });

  // TEST 2: Reject empty message content
  total++;
  await new Promise((resolve) => {
    aliceSocket.emit(
      "message:send",
      {
        conversationId: groupConv.id,
        clientMessageId: crypto.randomUUID(),
        content: "   ",
      },
      (res) => {
        if (!res?.ok && res?.code === "INVALID_MESSAGE") {
          pass("2. Empty message content rejected with INVALID_MESSAGE");
        } else {
          fail("2. Empty content rejection failed", res);
        }
        resolve();
      }
    );
  });

  // TEST 3: Reject oversized message content
  total++;
  await new Promise((resolve) => {
    aliceSocket.emit(
      "message:send",
      {
        conversationId: groupConv.id,
        clientMessageId: crypto.randomUUID(),
        content: "x".repeat(6000),
      },
      (res) => {
        if (!res?.ok && res?.code === "MESSAGE_TOO_LARGE") {
          pass("3. Oversized message content rejected with MESSAGE_TOO_LARGE");
        } else {
          fail("3. Oversized content rejection failed", res);
        }
        resolve();
      }
    );
  });

  // TEST 4: Successful message send persists to PostgreSQL and returns canonical message
  total++;
  const clientMsgId1 = crypto.randomUUID();
  const testContent1 = "Hello Bob from Alice via WebSocket!";
  let receivedByBob = null;
  let receivedByAlice = null;
  let receivedByCharlie = null;

  bobSocket.on("message:new", (msg) => {
    if (msg.clientMessageId === clientMsgId1) {
      receivedByBob = msg;
    }
  });

  aliceSocket.on("message:new", (msg) => {
    if (msg.clientMessageId === clientMsgId1) {
      receivedByAlice = msg;
    }
  });

  charlieSocket.on("message:new", (msg) => {
    if (msg.clientMessageId === clientMsgId1) {
      receivedByCharlie = msg;
    }
  });

  let ackResult1 = null;
  await new Promise((resolve) => {
    aliceSocket.emit(
      "message:send",
      {
        conversationId: groupConv.id,
        clientMessageId: clientMsgId1,
        content: testContent1,
      },
      (res) => {
        ackResult1 = res;
        resolve();
      }
    );
  });

  // Small delay to allow socket event broadcast to arrive
  await new Promise((r) => setTimeout(r, 200));

  if (
    ackResult1?.ok &&
    ackResult1?.duplicate === false &&
    ackResult1?.message?.content === testContent1 &&
    ackResult1?.message?.senderId === alice.id &&
    ackResult1?.message?.sender?.name === alice.name
  ) {
    pass("4. Sender receives acknowledgement with canonical persisted message");
  } else {
    fail("4. Sender acknowledgement failed", ackResult1);
  }

  // TEST 5: Authorized room members receive message:new broadcast; unauthorized do not
  total++;
  if (
    receivedByBob &&
    receivedByBob.content === testContent1 &&
    receivedByAlice &&
    receivedByAlice.content === testContent1 &&
    receivedByCharlie === null
  ) {
    pass("5. Room members receive message:new broadcast; unauthorized sockets do not");
  } else {
    fail("5. Room broadcast mismatch", {
      receivedByBob,
      receivedByAlice,
      receivedByCharlie,
    });
  }

  // TEST 6: Database contains exactly one row with sender_id and client_message_id
  total++;
  const { rows: dbRows } = await pool.query(
    "SELECT * FROM messages WHERE sender_id = $1 AND client_message_id = $2",
    [alice.id, clientMsgId1]
  );
  if (dbRows.length === 1 && dbRows[0].content === testContent1) {
    pass("6. Database contains exactly 1 persisted row matching client_message_id");
  } else {
    fail("6. Database persistence check failed", dbRows);
  }

  // TEST 7: Duplicate retry with same clientMessageId returns duplicate: true, no duplicate broadcast
  total++;
  let duplicateBroadcastReceived = false;
  bobSocket.on("message:new", (msg) => {
    if (msg.clientMessageId === clientMsgId1 && receivedByBob) {
      duplicateBroadcastReceived = true;
    }
  });

  // Get conversation updated_at before retry
  const { rows: convBefore } = await pool.query("SELECT updated_at FROM conversations WHERE id = $1", [groupConv.id]);
  const updatedAtBefore = convBefore[0].updated_at;

  let retryAck = null;
  await new Promise((resolve) => {
    aliceSocket.emit(
      "message:send",
      {
        conversationId: groupConv.id,
        clientMessageId: clientMsgId1,
        content: testContent1,
      },
      (res) => {
        retryAck = res;
        resolve();
      }
    );
  });

  await new Promise((r) => setTimeout(r, 200));

  const { rows: convAfter } = await pool.query("SELECT updated_at FROM conversations WHERE id = $1", [groupConv.id]);
  const updatedAtAfter = convAfter[0].updated_at;

  const { rows: dbRowsAfterRetry } = await pool.query(
    "SELECT * FROM messages WHERE sender_id = $1 AND client_message_id = $2",
    [alice.id, clientMsgId1]
  );

  if (
    retryAck?.ok === true &&
    retryAck?.duplicate === true &&
    retryAck?.message?.id === ackResult1?.message?.id &&
    dbRowsAfterRetry.length === 1 &&
    !duplicateBroadcastReceived &&
    new Date(updatedAtBefore).getTime() === new Date(updatedAtAfter).getTime()
  ) {
    pass("7. Duplicate retry handled idempotently without re-broadcasting or bumping conversation activity");
  } else {
    fail("7. Duplicate retry failed", {
      retryAck,
      dbRowsCount: dbRowsAfterRetry.length,
      duplicateBroadcastReceived,
      updatedAtBefore,
      updatedAtAfter,
    });
  }

  // TEST 8: Removed member cannot send message
  total++;
  // Add Charlie to group and then remove Charlie
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

  await new Promise((resolve) => {
    charlieSocket.emit(
      "message:send",
      {
        conversationId: groupConv.id,
        clientMessageId: crypto.randomUUID(),
        content: "Trying to speak after removal!",
      },
      (res) => {
        if (!res?.ok && res?.code === "CONVERSATION_ACCESS_DENIED") {
          pass("8. Removed member cannot send message (CONVERSATION_ACCESS_DENIED)");
        } else {
          fail("8. Removed member check failed", res);
        }
        resolve();
      }
    );
  });

  // Clean up
  aliceSocket.disconnect();
  bobSocket.disconnect();
  charlieSocket.disconnect();

  console.log(`\n=== Verification Complete: ${passed}/${total} tests passed ===`);
  await pool.end();

  if (passed !== total) {
    process.exit(1);
  }
}

verifyRealtimeMessaging().catch((err) => {
  console.error("Unhandled error in test runner:", err);
  process.exit(1);
});
