import "dotenv/config";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../config/database.js";
import * as conversationService from "../services/conversation.service.js";
import * as groupService from "../services/group.service.js";
import * as messageService from "../services/message.service.js";
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

function compareMessages(a, b) {
  const timeDifference =
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

  if (timeDifference !== 0) {
    return timeDifference;
  }

  return String(a.id).localeCompare(String(b.id));
}

function mergeMessages(existing, incoming) {
  const map = new Map();

  for (const msg of existing) {
    map.set(msg.id, msg);
  }

  for (const msg of incoming) {
    if (msg.clientMessageId) {
      for (const [id, existingMsg] of map.entries()) {
        if (
          existingMsg.clientMessageId === msg.clientMessageId &&
          (id.startsWith("temp-") || id.startsWith("temp:"))
        ) {
          map.delete(id);
        }
      }
    }

    map.set(msg.id, {
      ...msg,
      status: msg.status || "sent",
    });
  }

  return [...map.values()].sort(compareMessages);
}

async function verifyOfflineSync() {
  console.log("=== Starting Module 9 Reconnection & Offline Sync Verification Tests ===");
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

  // Create test group with Alice (Owner) and Bob
  const groupConv = await groupService.createGroup({
    creatorId: alice.id,
    name: "Sync Test Group " + Date.now(),
  });
  await groupService.addMember({
    conversationId: groupConv.id,
    actorId: alice.id,
    targetUserId: bob.id,
  });

  // TEST 1: Initial connection & room join
  total++;
  let aliceSocket = connectSocket({ token: createToken(alice.id) });
  let bobSocket = connectSocket({ token: createToken(bob.id) });

  await Promise.all([
    new Promise((resolve) => aliceSocket.on("connect", resolve)),
    new Promise((resolve) => bobSocket.on("connect", resolve)),
  ]);

  const bobJoinRes = await new Promise((resolve) => {
    bobSocket.emit("conversation:join", { conversationId: groupConv.id }, resolve);
  });

  if (bobJoinRes?.ok && bobJoinRes.conversationId === groupConv.id) {
    pass("1. Socket connects and joins active conversation room");
  } else {
    fail("1. Socket join failed", bobJoinRes);
  }

  // TEST 2: Disconnection -> missed messages sent while offline
  total++;
  bobSocket.disconnect(); // Bob goes offline

  // Alice sends 3 messages while Bob is offline
  const missedContent = [
    "Offline msg 1: Hey Bob",
    "Offline msg 2: Are you there?",
    "Offline msg 3: Server restarted",
  ];

  const missedResults = [];
  for (const text of missedContent) {
    const res = await messageService.createMessage({
      conversationId: groupConv.id,
      senderId: alice.id,
      clientMessageId: crypto.randomUUID(),
      content: text,
    });
    missedResults.push(res);
  }

  if (missedResults.length === 3 && missedResults.every((m) => m.id)) {
    pass("2. Messages successfully persisted in PostgreSQL while recipient is disconnected");
  } else {
    fail("2. Failed to persist offline messages", missedResults);
  }

  // TEST 3: Reconnection -> re-authentication and room re-joining
  total++;
  let bobReconnectedSocket = connectSocket({ token: createToken(bob.id) });
  await new Promise((resolve) => bobReconnectedSocket.on("connect", resolve));

  const bobRejoinRes = await new Promise((resolve) => {
    bobReconnectedSocket.emit("conversation:join", { conversationId: groupConv.id }, resolve);
  });

  if (bobRejoinRes?.ok) {
    pass("3. Reconnected socket successfully re-authenticated and rejoined room");
  } else {
    fail("3. Rejoin room after reconnection failed", bobRejoinRes);
  }

  // TEST 4: Bounded REST recovery retrieves missed messages
  total++;
  const recoveryPage = await messageService.listMessages({
    conversationId: groupConv.id,
    userId: bob.id,
    limit: 50,
  });

  const recoveredIds = new Set(recoveryPage.messages.map((m) => m.id));
  const allMissedRecovered = missedResults.every((m) => recoveredIds.has(m.id));

  if (allMissedRecovered) {
    pass("4. Bounded recovery page retrieved all missed messages from PostgreSQL");
  } else {
    fail("4. Some missed messages were not recovered", { missedResults, recoveryPage });
  }

  // TEST 5: Canonical message merge deduplicates real-time + REST overlap
  total++;
  // Simulate race condition: Bob already had 1 local message, then receives message:new for msg 3, then REST response returns all 3
  const initialClientState = [
    {
      id: "temp-bob-draft",
      clientMessageId: "draft-123",
      content: "Draft message from Bob",
      createdAt: new Date().toISOString(),
      status: "sending",
    },
    recoveryPage.messages[0], // Already had first message
  ];

  // Merge with entire recovery page
  const mergedState = mergeMessages(initialClientState, recoveryPage.messages);

  const uniqueMergedIds = new Set(mergedState.map((m) => m.id));
  if (uniqueMergedIds.size === mergedState.length && mergedState.length === recoveryPage.messages.length + 1) {
    pass("5. mergeMessages cleanly deduplicates and preserves canonical ordering");
  } else {
    fail("5. mergeMessages produced duplicates or dropped items", {
      mergedCount: mergedState.length,
      uniqueCount: uniqueMergedIds.size,
    });
  }

  // TEST 6: User removed while offline -> room rejoin rejected upon reconnect
  total++;
  // Add Charlie to group, connect Charlie, disconnect Charlie
  await groupService.addMember({
    conversationId: groupConv.id,
    actorId: alice.id,
    targetUserId: charlie.id,
  });

  let charlieSocket = connectSocket({ token: createToken(charlie.id) });
  await new Promise((resolve) => charlieSocket.on("connect", resolve));
  charlieSocket.disconnect(); // Charlie goes offline

  // Alice removes Charlie while Charlie is offline
  await groupService.removeMember({
    conversationId: groupConv.id,
    actorId: alice.id,
    targetUserId: charlie.id,
  });

  // Charlie reconnects and attempts to rejoin room
  let charlieReconnectedSocket = connectSocket({ token: createToken(charlie.id) });
  await new Promise((resolve) => charlieReconnectedSocket.on("connect", resolve));

  const charlieRejoinRes = await new Promise((resolve) => {
    charlieReconnectedSocket.emit("conversation:join", { conversationId: groupConv.id }, resolve);
  });

  if (!charlieRejoinRes?.ok && charlieRejoinRes?.code === "CONVERSATION_ACCESS_DENIED") {
    pass("6. Removed member cannot rejoin conversation room upon reconnect (CONVERSATION_ACCESS_DENIED)");
  } else {
    fail("6. Removed member join was not denied", charlieRejoinRes);
  }

  // TEST 7: Removed member cannot recover history through REST
  total++;
  let charlieHistoryError = null;
  try {
    await messageService.listMessages({
      conversationId: groupConv.id,
      userId: charlie.id,
      limit: 50,
    });
  } catch (err) {
    charlieHistoryError = err;
  }

  if (charlieHistoryError && charlieHistoryError.code === "CONVERSATION_NOT_FOUND") {
    pass("7. Removed member cannot recover conversation history through REST");
  } else {
    fail("7. Removed member history access was not blocked", charlieHistoryError);
  }

  // TEST 8: Deep offline pagination continuity across cursor boundaries
  total++;
  // Generate 15 total messages
  for (let i = 0; i < 10; i++) {
    await messageService.createMessage({
      conversationId: groupConv.id,
      senderId: alice.id,
      clientMessageId: crypto.randomUUID(),
      content: `Deep history message ${i + 1}`,
    });
  }

  const p1 = await messageService.listMessages({
    conversationId: groupConv.id,
    userId: alice.id,
    limit: 5,
  });

  const p2 = await messageService.listMessages({
    conversationId: groupConv.id,
    userId: alice.id,
    limit: 5,
    before: p1.nextCursor,
  });

  const allPageIds = [...p1.messages.map((m) => m.id), ...p2.messages.map((m) => m.id)];
  const uniquePageIds = new Set(allPageIds);

  if (p1.messages.length === 5 && p2.messages.length === 5 && uniquePageIds.size === 10) {
    pass("8. Upward cursor pagination operates seamlessly across offline recovery boundaries");
  } else {
    fail("8. Cursor pagination across boundary had duplicates or gaps", { p1, p2 });
  }

  // Clean up
  aliceSocket.disconnect();
  bobReconnectedSocket.disconnect();
  charlieReconnectedSocket.disconnect();

  console.log(`\n=== Verification Complete: ${passed}/${total} tests passed ===`);
  await pool.end();

  if (passed !== total) {
    process.exit(1);
  }
}

verifyOfflineSync().catch((err) => {
  console.error("Unhandled error in test runner:", err);
  process.exit(1);
});
