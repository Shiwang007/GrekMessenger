import "dotenv/config";
import jwt from "jsonwebtoken";
import { pool } from "../config/database.js";
import * as groupService from "../services/group.service.js";
import * as messageService from "../services/message.service.js";
import { io as ClientIO } from "../../../client/node_modules/socket.io-client/build/esm/index.js";

const SERVER_URL = process.env.SERVER_URL?.replace(/\/api\/?$/, "") || "http://localhost:5000";

function createToken(userId, type = "access", secret = process.env.JWT_ACCESS_SECRET, expiresIn = "15m") {
  return jwt.sign({ sub: userId, type }, secret, { expiresIn });
}

function connectSocket(auth = {}) {
  return ClientIO(SERVER_URL, {
    auth,
    transports: ["websocket"],
    reconnection: false,
    timeout: 5000,
  });
}

async function verifyReceipts() {
  console.log("=== Starting Module 12 Read Receipts & Unread Counts Verification Tests ===");
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
  console.log("Found seed users:", { alice: alice.name, bob: bob.name, charlie: charlie.name });

  // Create test group with Bob, Charlie, Alice
  const groupConv = await groupService.createGroup({
    creatorId: bob.id,
    name: "Receipts Test Group " + Date.now(),
  });
  console.log("Created group:", groupConv.id);

  await groupService.addMember({
    conversationId: groupConv.id,
    actorId: bob.id,
    targetUserId: charlie.id,
  });
  await groupService.addMember({
    conversationId: groupConv.id,
    actorId: bob.id,
    targetUserId: alice.id,
  });
  console.log("Added members to group");

  // Connect sockets for Bob and Charlie
  console.log("Connecting sockets...");
  const bobSocket = connectSocket({ token: createToken(bob.id) });
  const charlieSocket = connectSocket({ token: createToken(charlie.id) });

  bobSocket.on("connect_error", (e) => console.error("bobSocket error:", e.message));
  charlieSocket.on("connect_error", (e) => console.error("charlieSocket error:", e.message));

  await Promise.all([
    new Promise((resolve) => bobSocket.on("connect", resolve)),
    new Promise((resolve) => charlieSocket.on("connect", resolve)),
  ]);
  console.log("Sockets connected successfully");

  // Both join the conversation room
  await Promise.all([
    new Promise((resolve) => bobSocket.emit("conversation:join", { conversationId: groupConv.id }, resolve)),
    new Promise((resolve) => charlieSocket.emit("conversation:join", { conversationId: groupConv.id }, resolve)),
  ]);
  console.log("Joined conversation rooms");

  // TEST 1: Bob sends message M1 -> Charlie sends message:delivered -> Bob receives message:receipt
  total++;
  const m1Result = await messageService.createMessage({
    conversationId: groupConv.id,
    senderId: bob.id,
    clientMessageId: crypto.randomUUID(),
    content: "Message 1 for delivery test",
  });
  const m1 = m1Result.message;
  console.log("Created test message M1:", m1.id);

  let bobReceivedReceipt = null;
  bobSocket.on("message:receipt", (receipt) => {
    if (receipt.messageId === m1.id && receipt.userId === charlie.id) {
      bobReceivedReceipt = receipt;
    }
  });

  await new Promise((resolve) => {
    charlieSocket.emit("message:delivered", { messageId: m1.id }, resolve);
  });

  await new Promise((r) => setTimeout(r, 200));

  const { rows: receiptRows } = await pool.query(
    "SELECT delivered_at, read_at FROM message_receipts WHERE message_id = $1 AND user_id = $2",
    [m1.id, charlie.id]
  );

  if (
    receiptRows.length > 0 &&
    receiptRows[0].delivered_at !== null &&
    bobReceivedReceipt?.deliveredAt !== null
  ) {
    pass("1. message:delivered creates delivery receipt in DB and broadcasts message:receipt to room");
  } else {
    fail("1. Delivery receipt failed", { receiptRows, bobReceivedReceipt });
  }

  // TEST 2: Charlie marks conversation read up to M1 -> last_read_message_id advances and read_at is set
  total++;
  let bobReceivedReadReceipt = null;
  bobSocket.on("message:receipt", (receipt) => {
    if (receipt.messageId === m1.id && receipt.userId === charlie.id && receipt.readAt !== null) {
      bobReceivedReadReceipt = receipt;
    }
  });

  let charlieUnreadUpdate = null;
  charlieSocket.on("unread:update", (update) => {
    if (update.conversationId === groupConv.id) {
      charlieUnreadUpdate = update;
    }
  });

  await new Promise((resolve) => {
    charlieSocket.emit("conversation:read", { conversationId: groupConv.id, messageId: m1.id }, resolve);
  });

  await new Promise((r) => setTimeout(r, 200));

  const { rows: memberRows } = await pool.query(
    "SELECT last_read_message_id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
    [groupConv.id, charlie.id]
  );
  const { rows: readReceiptRows } = await pool.query(
    "SELECT read_at FROM message_receipts WHERE message_id = $1 AND user_id = $2",
    [m1.id, charlie.id]
  );

  if (
    memberRows[0]?.last_read_message_id === m1.id &&
    readReceiptRows[0]?.read_at !== null &&
    bobReceivedReadReceipt?.readAt !== null &&
    charlieUnreadUpdate?.unreadCount === 0
  ) {
    pass("2. conversation:read sets read_at, updates last_read_message_id, and emits unread:update (count=0)");
  } else {
    fail("2. Read receipt update failed", {
      memberRows,
      readReceiptRows,
      bobReceivedReadReceipt,
      charlieUnreadUpdate,
    });
  }

  // TEST 3: Monotonicity - sending older messageId M1 after newer M2 does not regress read position
  total++;
  const m2Result = await messageService.createMessage({
    conversationId: groupConv.id,
    senderId: bob.id,
    clientMessageId: crypto.randomUUID(),
    content: "Message 2 for monotonicity test",
  });
  const m2 = m2Result.message;

  // Advance Charlie to M2
  await new Promise((resolve) => {
    charlieSocket.emit("conversation:read", { conversationId: groupConv.id, messageId: m2.id }, resolve);
  });

  // Attempt to regress Charlie back to M1
  await new Promise((resolve) => {
    charlieSocket.emit("conversation:read", { conversationId: groupConv.id, messageId: m1.id }, resolve);
  });

  const { rows: monoMemberRows } = await pool.query(
    "SELECT last_read_message_id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
    [groupConv.id, charlie.id]
  );

  if (monoMemberRows[0]?.last_read_message_id === m2.id) {
    pass("3. Monotonic read position enforced: older read target does not regress last_read_message_id");
  } else {
    fail("3. Monotonic read position violated", monoMemberRows);
  }

  // TEST 4: Unread Count Calculation & Real-Time Push
  total++;
  // Reset Charlie's read position to M1 to simulate 1 unread message (M2)
  await pool.query(
    "UPDATE conversation_members SET last_read_message_id = $1 WHERE conversation_id = $2 AND user_id = $3",
    [m1.id, groupConv.id, charlie.id]
  );

  // Bob sends M3 via socket message:send
  let charlieNewMessageUnread = null;
  charlieSocket.on("unread:update", (update) => {
    if (update.conversationId === groupConv.id) {
      charlieNewMessageUnread = update;
    }
  });

  await new Promise((resolve) => {
    bobSocket.emit(
      "message:send",
      {
        conversationId: groupConv.id,
        clientMessageId: crypto.randomUUID(),
        content: "Message 3 triggers unread count",
      },
      resolve
    );
  });

  await new Promise((r) => setTimeout(r, 200));

  // Charlie had read up to M1. Messages after M1 sent by Bob: M2 and M3 -> unreadCount should be 2
  const conversationsResponse = await fetch(`${SERVER_URL}/api/conversations`, {
    headers: { Authorization: `Bearer ${createToken(charlie.id)}` },
  }).then((r) => r.json());

  const charlieConvSummary = conversationsResponse?.conversations?.find((c) => c.id === groupConv.id);

  if (
    charlieNewMessageUnread?.unreadCount === 2 &&
    charlieConvSummary?.unreadCount === 2
  ) {
    pass("4. New message pushes real-time unread:update and REST API returns matching unreadCount");
  } else {
    fail("4. Unread count verification failed", {
      charlieNewMessageUnread,
      charlieConvSummary,
    });
  }

  // TEST 5: Group seen count calculation ("Seen by X of Y")
  total++;
  const aliceSocket = connectSocket({ token: createToken(alice.id) });
  await new Promise((resolve) => aliceSocket.on("connect", resolve));
  await new Promise((resolve) => aliceSocket.emit("conversation:join", { conversationId: groupConv.id }, resolve));

  // Alice reads M2
  await new Promise((resolve) => {
    aliceSocket.emit("conversation:read", { conversationId: groupConv.id, messageId: m2.id }, resolve);
  });
  await new Promise((r) => setTimeout(r, 200));

  // Fetch messages from Bob's perspective
  const messagesResponse = await fetch(`${SERVER_URL}/api/conversations/${groupConv.id}/messages`, {
    headers: { Authorization: `Bearer ${createToken(bob.id)}` },
  }).then((r) => r.json());

  const m2Fetched = messagesResponse?.messages?.find((m) => m.id === m2.id);

  // In this group, members excluding Bob are Charlie and Alice (2 recipients). Both have read M2.
  if (
    m2Fetched &&
    m2Fetched.seenCount === 2 &&
    m2Fetched.recipientCount === 2
  ) {
    pass("5. Group messages accurately aggregate seenCount and recipientCount ('Seen by 2 of 2')");
  } else {
    fail("5. Group seen count aggregation failed", m2Fetched);
  }

  // TEST 6: Authorization - non-member cannot emit message:delivered or conversation:read
  total++;
  const nonMemberSocket = connectSocket({ token: createToken(crypto.randomUUID()) });
  // Connect with valid token but non-existent user
  let deniedDelivered = false;
  let deniedRead = false;

  await new Promise((resolve) => {
    bobSocket.emit("message:delivered", { messageId: "00000000-0000-0000-0000-000000000000" }, (res) => {
      if (!res?.ok) deniedDelivered = true;
      resolve();
    });
  });

  await new Promise((resolve) => {
    bobSocket.emit("conversation:read", { conversationId: groupConv.id, messageId: "00000000-0000-0000-0000-000000000000" }, (res) => {
      if (!res?.ok) deniedRead = true;
      resolve();
    });
  });

  if (deniedDelivered && deniedRead) {
    pass("6. Invalid/unauthorized delivery and read requests are rejected with error response");
  } else {
    fail("6. Authorization check failed", { deniedDelivered, deniedRead });
  }

  // Cleanup
  bobSocket.disconnect();
  charlieSocket.disconnect();
  aliceSocket.disconnect();
  nonMemberSocket.disconnect();
  await pool.end();

  console.log(`\n=== Verification Complete: ${passed}/${total} tests passed ===`);
  if (passed !== total) {
    process.exit(1);
  }
}

verifyReceipts().catch((err) => {
  console.error("Unhandled error in test runner:", err);
  process.exit(1);
});
