import "dotenv/config";
import jwt from "jsonwebtoken";
import { pool } from "../config/database.js";
import * as groupService from "../services/group.service.js";
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

async function verifyTyping() {
  console.log("=== Starting Module 11 Typing Indicators Verification Tests ===");
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

  // Retrieve seed users: Bob and Charlie
  const { rows: users } = await pool.query("SELECT id, name, email FROM users ORDER BY email ASC");
  const bob = users.find((u) => u.email.startsWith("bob"));
  const charlie = users.find((u) => u.email.startsWith("charlie"));

  if (!bob || !charlie) {
    console.error("Required seed users (Bob, Charlie) not found!");
    process.exit(1);
  }

  // Create a dedicated test group for Bob and Charlie
  const groupConv = await groupService.createGroup({
    creatorId: bob.id,
    name: "Typing Test Group " + Date.now(),
  });
  await groupService.addMember({
    conversationId: groupConv.id,
    actorId: bob.id,
    targetUserId: charlie.id,
  });

  // Connect Bob and Charlie sockets
  const bobSocket = connectSocket({ token: createToken(bob.id) });
  const charlieSocket = connectSocket({ token: createToken(charlie.id) });

  await Promise.all([
    new Promise((resolve) => bobSocket.on("connect", resolve)),
    new Promise((resolve) => charlieSocket.on("connect", resolve)),
  ]);

  // Both join the group room
  await Promise.all([
    new Promise((resolve) => bobSocket.emit("conversation:join", { conversationId: groupConv.id }, resolve)),
    new Promise((resolve) => charlieSocket.emit("conversation:join", { conversationId: groupConv.id }, resolve)),
  ]);

  // TEST 1: Basic typing start and stop (sender excluded, peer notified)
  total++;
  let charlieReceivedStart = null;
  let bobReceivedSelfStart = null;

  charlieSocket.on("typing:update", (update) => {
    if (update.conversationId === groupConv.id && update.userId === bob.id && update.typing === true) {
      charlieReceivedStart = update;
    }
  });

  bobSocket.on("typing:update", (update) => {
    if (update.conversationId === groupConv.id && update.userId === bob.id && update.typing === true) {
      bobReceivedSelfStart = update;
    }
  });

  bobSocket.emit("typing:start", { conversationId: groupConv.id });
  await new Promise((r) => setTimeout(r, 200));

  if (charlieReceivedStart && !bobReceivedSelfStart) {
    pass("1. typing:start notifies room members while excluding sender");
  } else {
    fail("1. typing:start failed", { charlieReceivedStart, bobReceivedSelfStart });
  }

  // TEST 2: typing:stop notifies peer
  total++;
  let charlieReceivedStop = null;
  charlieSocket.on("typing:update", (update) => {
    if (update.conversationId === groupConv.id && update.userId === bob.id && update.typing === false) {
      charlieReceivedStop = update;
    }
  });

  bobSocket.emit("typing:stop", { conversationId: groupConv.id });
  await new Promise((r) => setTimeout(r, 200));

  if (charlieReceivedStop) {
    pass("2. typing:stop broadcasts typing:false to room members");
  } else {
    fail("2. typing:stop failed", { charlieReceivedStop });
  }

  // TEST 3: Repeated typing:start refreshes timer without redundant broadcast
  total++;
  let startBroadcastCount = 0;
  const startCounter = (update) => {
    if (update.conversationId === groupConv.id && update.userId === bob.id && update.typing === true) {
      startBroadcastCount++;
    }
  };
  charlieSocket.on("typing:update", startCounter);

  // Bob starts typing
  bobSocket.emit("typing:start", { conversationId: groupConv.id });
  await new Promise((r) => setTimeout(r, 100));

  // Bob sends repeated start events (refreshes)
  bobSocket.emit("typing:start", { conversationId: groupConv.id });
  bobSocket.emit("typing:start", { conversationId: groupConv.id });
  await new Promise((r) => setTimeout(r, 200));

  charlieSocket.off("typing:update", startCounter);

  if (startBroadcastCount === 1) {
    pass("3. Repeated typing:start refreshes timer without duplicate broadcast");
  } else {
    fail("3. Redundant typing:start events broadcasted", { startBroadcastCount });
  }

  // TEST 4: Automatic expiry on inactivity timeout (3s)
  total++;
  let expiredStopEvent = null;
  const expiryHandler = (update) => {
    if (update.conversationId === groupConv.id && update.userId === bob.id && update.typing === false) {
      expiredStopEvent = update;
    }
  };
  charlieSocket.on("typing:update", expiryHandler);

  console.log("   Waiting 3.2s for server typing expiration...");
  await new Promise((r) => setTimeout(r, 3200));
  charlieSocket.off("typing:update", expiryHandler);

  if (expiredStopEvent) {
    pass("4. Stale typing state automatically expires and emits typing:false after 3s timeout");
  } else {
    fail("4. Expiration timeout failed", { expiredStopEvent });
  }

  // TEST 5: Authorization check (non-member cannot emit typing to a room)
  total++;
  // Create a private group only for Charlie
  const privateGroup = await groupService.createGroup({
    creatorId: charlie.id,
    name: "Charlie Private " + Date.now(),
  });

  let unauthorizedTypingUpdate = null;
  charlieSocket.on("typing:update", (update) => {
    if (update.conversationId === privateGroup.id) {
      unauthorizedTypingUpdate = update;
    }
  });

  // Bob attempts to emit typing:start into Charlie's private group
  bobSocket.emit("typing:start", { conversationId: privateGroup.id });
  await new Promise((r) => setTimeout(r, 200));

  if (!unauthorizedTypingUpdate) {
    pass("5. Non-member typing:start is ignored and not broadcasted");
  } else {
    fail("5. Unauthorized typing allowed", { unauthorizedTypingUpdate });
  }

  // TEST 6: Disconnect cleanup clears active typing state
  total++;
  let disconnectStopEvent = null;
  charlieSocket.on("typing:update", (update) => {
    if (update.conversationId === groupConv.id && update.userId === bob.id && update.typing === false) {
      disconnectStopEvent = update;
    }
  });

  // Bob starts typing again
  bobSocket.emit("typing:start", { conversationId: groupConv.id });
  await new Promise((r) => setTimeout(r, 100));

  // Bob disconnects socket
  bobSocket.disconnect();
  await new Promise((r) => setTimeout(r, 300));

  if (disconnectStopEvent) {
    pass("6. Socket disconnect cleans up active typing state and emits typing:false");
  } else {
    fail("6. Disconnect typing cleanup failed", { disconnectStopEvent });
  }

  // Clean up
  charlieSocket.disconnect();
  await pool.end();

  console.log(`\n=== Verification Complete: ${passed}/${total} tests passed ===`);
  if (passed !== total) {
    process.exit(1);
  }
}

verifyTyping().catch((err) => {
  console.error("Unhandled error in test runner:", err);
  process.exit(1);
});
