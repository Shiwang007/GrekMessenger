import "dotenv/config";
import jwt from "jsonwebtoken";
import { pool } from "../config/database.js";
import * as conversationService from "../services/conversation.service.js";
import * as groupService from "../services/group.service.js";
import { io as ClientIO } from "../../../client/node_modules/socket.io-client/build/esm/index.js";

const SOCKET_URL = process.env.SERVER_URL?.replace(/\/api\/?$/, "") || "http://localhost:5000";

function createToken(userId, type = "access", secret = process.env.JWT_ACCESS_SECRET, expiresIn = "15m") {
  return jwt.sign({ sub: userId, type }, secret, { expiresIn });
}

async function verifySocketAuth() {
  console.log("=== Starting Module 7 Socket Auth Verification Tests ===");
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

  // Set up test direct conversation between Alice and Bob
  const directConv = await conversationService.getOrCreateDirectConversation({
    currentUserId: alice.id,
    targetUserId: bob.id,
  });

  // Set up test group with Alice (Owner) and Bob
  const groupConv = await groupService.createGroup({
    creatorId: alice.id,
    name: "Socket Test Group " + Date.now(),
  });
  await groupService.addMember({
    conversationId: groupConv.id,
    actorId: alice.id,
    targetUserId: bob.id,
  });

  // Helper to connect a socket client
  function connectSocket(auth = {}) {
    return ClientIO(SOCKET_URL, {
      auth,
      transports: ["websocket"],
      reconnection: false,
      timeout: 5000,
    });
  }

  // 1. Connection without token
  total++;
  await new Promise((resolve) => {
    const socket = connectSocket({});
    socket.on("connect", () => {
      fail("1. No token must be rejected", "Connected unexpectedly");
      socket.disconnect();
      resolve();
    });
    socket.on("connect_error", (err) => {
      if (err?.data?.code === "AUTH_REQUIRED" || err?.message === "AUTH_REQUIRED") {
        pass("1. Connection without token rejected with AUTH_REQUIRED");
      } else {
        fail("1. No token error code mismatch", err);
      }
      socket.disconnect();
      resolve();
    });
  });

  // 2. Connection with malformed token
  total++;
  await new Promise((resolve) => {
    const socket = connectSocket({ token: "not-a-valid-jwt" });
    socket.on("connect", () => {
      fail("2. Malformed token must be rejected", "Connected unexpectedly");
      socket.disconnect();
      resolve();
    });
    socket.on("connect_error", (err) => {
      if (err?.data?.code === "AUTH_INVALID" || err?.message === "AUTH_INVALID") {
        pass("2. Connection with malformed token rejected with AUTH_INVALID");
      } else {
        fail("2. Malformed token error code mismatch", err);
      }
      socket.disconnect();
      resolve();
    });
  });

  // 3. Connection with token signed with wrong secret
  total++;
  await new Promise((resolve) => {
    const wrongToken = createToken(alice.id, "access", "completely-wrong-secret-12345678");
    const socket = connectSocket({ token: wrongToken });
    socket.on("connect", () => {
      fail("3. Wrong secret token must be rejected", "Connected unexpectedly");
      socket.disconnect();
      resolve();
    });
    socket.on("connect_error", (err) => {
      if (err?.data?.code === "AUTH_INVALID" || err?.message === "AUTH_INVALID") {
        pass("3. Connection with wrong signing secret rejected with AUTH_INVALID");
      } else {
        fail("3. Wrong secret error code mismatch", err);
      }
      socket.disconnect();
      resolve();
    });
  });

  // 4. Connection with refresh token
  total++;
  await new Promise((resolve) => {
    const refreshToken = createToken(alice.id, "refresh");
    const socket = connectSocket({ token: refreshToken });
    socket.on("connect", () => {
      fail("4. Refresh token must be rejected", "Connected unexpectedly");
      socket.disconnect();
      resolve();
    });
    socket.on("connect_error", (err) => {
      if (err?.data?.code === "AUTH_INVALID" || err?.message === "AUTH_INVALID") {
        pass("4. Connection with refresh token rejected with AUTH_INVALID");
      } else {
        fail("4. Refresh token error code mismatch", err);
      }
      socket.disconnect();
      resolve();
    });
  });

  // 5. Connection with expired token
  total++;
  await new Promise((resolve) => {
    const expiredToken = createToken(alice.id, "access", process.env.JWT_ACCESS_SECRET, "-10s");
    const socket = connectSocket({ token: expiredToken });
    socket.on("connect", () => {
      fail("5. Expired token must be rejected", "Connected unexpectedly");
      socket.disconnect();
      resolve();
    });
    socket.on("connect_error", (err) => {
      if (err?.data?.code === "AUTH_EXPIRED" || err?.data?.code === "AUTH_INVALID") {
        pass("5. Connection with expired token rejected with AUTH_EXPIRED/AUTH_INVALID");
      } else {
        fail("5. Expired token error code mismatch", err);
      }
      socket.disconnect();
      resolve();
    });
  });

  // 6. Valid access JWT connection
  total++;
  let aliceSocket;
  const aliceToken = createToken(alice.id);
  await new Promise((resolve) => {
    aliceSocket = connectSocket({ token: aliceToken });
    aliceSocket.on("connect", () => {
      pass("6. Valid access JWT successfully authenticates and connects");
      resolve();
    });
    aliceSocket.on("connect_error", (err) => {
      fail("6. Valid JWT failed connection", err);
      resolve();
    });
  });

  // 7. Active member joins conversation
  total++;
  await new Promise((resolve) => {
    aliceSocket.emit("conversation:join", { conversationId: groupConv.id }, (response) => {
      if (response?.ok && response?.conversationId === groupConv.id) {
        pass("7. Active member authorized to join conversation room");
      } else {
        fail("7. Active member join failed", response);
      }
      resolve();
    });
  });

  // 8. Non-member joins conversation
  total++;
  const charlieToken = createToken(charlie.id);
  let charlieSocket;
  await new Promise((resolve) => {
    charlieSocket = connectSocket({ token: charlieToken });
    charlieSocket.on("connect", () => {
      // Charlie tries to join Alice & Bob's direct conversation
      charlieSocket.emit("conversation:join", { conversationId: directConv.id }, (response) => {
        if (!response?.ok && response?.code === "CONVERSATION_ACCESS_DENIED") {
          pass("8. Non-member rejected with CONVERSATION_ACCESS_DENIED");
        } else {
          fail("8. Non-member join was not rejected", response);
        }
        resolve();
      });
    });
  });

  // 9. Removed member joins conversation
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
    charlieSocket.emit("conversation:join", { conversationId: groupConv.id }, (response) => {
      if (!response?.ok && response?.code === "CONVERSATION_ACCESS_DENIED") {
        pass("9. Removed member denied with CONVERSATION_ACCESS_DENIED");
      } else {
        fail("9. Removed member join was not denied", response);
      }
      charlieSocket.disconnect();
      resolve();
    });
  });

  // 10. Leave conversation room
  total++;
  await new Promise((resolve) => {
    aliceSocket.emit("conversation:leave", { conversationId: groupConv.id }, (response) => {
      if (response?.ok && response?.conversationId === groupConv.id) {
        pass("10. Member left conversation room successfully");
      } else {
        fail("10. Leave conversation failed", response);
      }
      resolve();
    });
  });

  // 11. Multi-room joins
  total++;
  await new Promise(async (resolve) => {
    const p1 = new Promise((r) => aliceSocket.emit("conversation:join", { conversationId: directConv.id }, r));
    const p2 = new Promise((r) => aliceSocket.emit("conversation:join", { conversationId: groupConv.id }, r));
    const [res1, res2] = await Promise.all([p1, p2]);

    if (res1?.ok && res2?.ok) {
      pass("11. User can join multiple authorized conversation rooms concurrently");
    } else {
      fail("11. Multi-room joins failed", { res1, res2 });
    }
    aliceSocket.disconnect();
    resolve();
  });

  // 12. Token reaches exp -> auth:expired emitted and socket disconnected
  total++;
  await new Promise((resolve) => {
    // Generate token expiring in 2 seconds
    const shortLivedToken = createToken(alice.id, "access", process.env.JWT_ACCESS_SECRET, "2s");
    const expiringSocket = connectSocket({ token: shortLivedToken });

    let receivedAuthExpired = false;

    expiringSocket.on("auth:expired", (data) => {
      if (data?.code === "AUTH_TOKEN_EXPIRED") {
        receivedAuthExpired = true;
      }
    });

    expiringSocket.on("disconnect", () => {
      if (receivedAuthExpired) {
        pass("12. Expired token triggers auth:expired event and forces socket disconnect");
      } else {
        fail("12. Socket disconnected without auth:expired event");
      }
      resolve();
    });

    // Timeout safety
    setTimeout(() => {
      if (!receivedAuthExpired) {
        fail("12. Token expiry test timed out without disconnect");
        expiringSocket.disconnect();
        resolve();
      }
    }, 4500);
  });

  console.log(`\n=== Verification Complete: ${passed}/${total} tests passed ===`);
  await pool.end();

  if (passed !== total) {
    process.exit(1);
  }
}

verifySocketAuth().catch((err) => {
  console.error("Unhandled error in test runner:", err);
  process.exit(1);
});
