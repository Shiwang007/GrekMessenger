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

async function getRemotePresence(userId, requesterId) {
  const response = await fetch(`${SERVER_URL}/api/users/${userId}/presence`, {
    headers: {
      Authorization: `Bearer ${createToken(requesterId)}`,
    },
  });
  const data = await response.json();
  return data.presence;
}

async function verifyPresence() {
  console.log("=== Starting Module 10 Presence Verification Tests ===");
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

  // Retrieve seed users: Bob and Charlie (Charlie is not logged in on any browser)
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
    name: "Presence Test Group " + Date.now(),
  });
  await groupService.addMember({
    conversationId: groupConv.id,
    actorId: bob.id,
    targetUserId: charlie.id,
  });

  // TEST 1: Unauthenticated socket does not affect presence
  total++;
  await new Promise((resolve) => {
    const unauthSocket = connectSocket({});
    unauthSocket.on("connect", () => {
      fail("1. Unauthenticated socket should not connect", null);
      unauthSocket.disconnect();
      resolve();
    });
    unauthSocket.on("connect_error", async () => {
      const presence = await getRemotePresence(charlie.id, bob.id);
      if (presence?.online === false) {
        pass("1. Unauthenticated socket rejected before presence registration");
      } else {
        fail("1. Unauthenticated connection registered in presence", presence);
      }
      unauthSocket.disconnect();
      resolve();
    });
  });

  // Connect Bob to listen for Charlie's presence updates
  let bobSocket = connectSocket({ token: createToken(bob.id) });
  await new Promise((resolve) => bobSocket.on("connect", resolve));
  await new Promise((resolve) => {
    bobSocket.emit("conversation:join", { conversationId: groupConv.id }, resolve);
  });

  // TEST 2: Single socket connect -> Charlie becomes online and peers receive presence:update
  total++;
  let charlieOnlineEvent = null;
  bobSocket.on("presence:update", (update) => {
    if (update.userId === charlie.id && update.online === true) {
      charlieOnlineEvent = update;
    }
  });

  let charlieSocket1 = connectSocket({ token: createToken(charlie.id) });
  await new Promise((resolve) => charlieSocket1.on("connect", resolve));

  // Small delay for event propagation
  await new Promise((r) => setTimeout(r, 200));

  const initialPresence = await getRemotePresence(charlie.id, bob.id);

  if (
    initialPresence?.online === true &&
    charlieOnlineEvent?.userId === charlie.id &&
    charlieOnlineEvent?.online === true &&
    charlieOnlineEvent?.lastSeenAt === null
  ) {
    pass("2. Single socket connection marks user online and broadcasts presence:update to peer");
  } else {
    fail("2. Single socket connect presence failed", {
      initialPresence,
      charlieOnlineEvent,
    });
  }

  // TEST 3: Multi-tab connect: second socket does NOT re-trigger transition or disrupt online state
  total++;
  let redundantOnlineCount = 0;
  bobSocket.on("presence:update", (update) => {
    if (update.userId === charlie.id && update.online === true) {
      redundantOnlineCount++;
    }
  });

  let charlieSocket2 = connectSocket({ token: createToken(charlie.id) });
  await new Promise((resolve) => charlieSocket2.on("connect", resolve));

  await new Promise((r) => setTimeout(r, 200));
  const multiPresence = await getRemotePresence(charlie.id, bob.id);

  if (multiPresence?.online === true && redundantOnlineCount === 0) {
    pass("3. Opening a second tab keeps user online without emitting redundant online transitions");
  } else {
    fail("3. Second socket connect caused unexpected state", { redundantOnlineCount, multiPresence });
  }

  // TEST 4: Multi-tab disconnect: closing Tab 1 leaves user online (Tab 2 still open)
  total++;
  let prematureOfflineEvent = null;
  bobSocket.on("presence:update", (update) => {
    if (update.userId === charlie.id && update.online === false) {
      prematureOfflineEvent = update;
    }
  });

  charlieSocket1.disconnect(); // Close first tab
  await new Promise((r) => setTimeout(r, 200));
  const tab1ClosedPresence = await getRemotePresence(charlie.id, bob.id);

  if (tab1ClosedPresence?.online === true && prematureOfflineEvent === null) {
    pass("4. Disconnecting first tab leaves user online while second tab remains connected");
  } else {
    fail("4. Disconnecting first tab triggered premature offline state", {
      tab1ClosedPresence,
      prematureOfflineEvent,
    });
  }

  // TEST 5: Last tab disconnect -> user transitions to offline and persists last_seen_at
  total++;
  let charlieOfflineEvent = null;
  bobSocket.on("presence:update", (update) => {
    if (update.userId === charlie.id && update.online === false) {
      charlieOfflineEvent = update;
    }
  });

  charlieSocket2.disconnect(); // Close second (final) tab
  await new Promise((r) => setTimeout(r, 300));

  const finalPresence = await getRemotePresence(charlie.id, bob.id);
  const { rows: dbUser } = await pool.query(
    "SELECT last_seen_at FROM users WHERE id = $1",
    [charlie.id]
  );
  const dbLastSeen = dbUser[0]?.last_seen_at;

  if (
    finalPresence?.online === false &&
    charlieOfflineEvent?.online === false &&
    charlieOfflineEvent?.lastSeenAt !== null &&
    dbLastSeen !== null
  ) {
    pass("5. Disconnecting last socket transitions user offline, emits presence:update, and persists last_seen_at");
  } else {
    fail("5. Final disconnect failed", {
      finalPresence,
      charlieOfflineEvent,
      dbLastSeen,
    });
  }

  // TEST 6: Group conversation details include presence snapshots for all members
  total++;
  const groupDetails = await fetch(`${SERVER_URL}/api/conversations/${groupConv.id}`, {
    headers: { Authorization: `Bearer ${createToken(bob.id)}` },
  }).then((r) => r.json());

  const charlieInGroup = groupDetails?.conversation?.members?.find((m) => m.id === charlie.id);

  if (
    charlieInGroup &&
    charlieInGroup.online === false &&
    charlieInGroup.lastSeenAt !== undefined
  ) {
    pass("6. Conversation details include accurate presence snapshot (member.online, member.lastSeenAt)");
  } else {
    fail("6. Conversation details presence snapshot mismatch", charlieInGroup);
  }

  // Clean up
  bobSocket.disconnect();

  console.log(`\n=== Verification Complete: ${passed}/${total} tests passed ===`);
  await pool.end();

  if (passed !== total) {
    process.exit(1);
  }
}

verifyPresence().catch((err) => {
  console.error("Unhandled error in test runner:", err);
  process.exit(1);
});
