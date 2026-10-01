# Backend & Real-Time Gateway — GrekMessenger

Node.js (Express + Socket.IO) real-time messaging gateway backed by PostgreSQL with keyset pagination, delivery/read receipts, typing indicators, and emoji reactions.

---

## 1. Setup & Run Instructions

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+) running locally or accessible via network

### Environment Configuration
Create `server/.env`:
```env
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/grek_messenger

# JWT Authentication
JWT_ACCESS_SECRET=your_super_secret_access_key_min_32_chars
JWT_REFRESH_SECRET=your_super_secret_refresh_key_min_32_chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CLIENT_URL=http://localhost:5173
```

### Installation & Migration
```bash
# 1. Install dependencies
npm install

# 2. Run database migrations
npm run migrate

# 3. (Optional) Seed demo users & messages
npm run seed

# 4. Start backend in development mode (hot-reload via nodemon)
npm run dev
```

### Verification Test Suites
Run individual verification scripts to validate subsystems:
```bash
npm run test:db             # Database integrity & schema checks
npm run test:auth           # JWT authentication & refresh rotation
npm run test:users          # User discovery & search
npm run test:conversations  # Direct/group creation, RBAC, pagination
```

---

## 2. Socket.IO Authorization Architecture

Real-time connections use a multi-tiered authorization model:

```
[Client Handshake]
       │
       ▼
socket.auth = { token: ACCESS_TOKEN }
       │
       ▼
[verifySocketToken Middleware]
  ├── Verify JWT signature with JWT_ACCESS_SECRET
  ├── Validate user still exists in database
  └── Attach socket.user = { id, email, name }
       │
       ▼ (Success)
Join personal user room: "user:{userId}"
Schedule token expiry auto-disconnect
       │
       ▼
[Event Handler Authorization]
For any conversation action (send, read, reaction, typing):
  └── requireMember({ conversationId, userId })
      Checks active membership in PostgreSQL before proceeding
```

### Key Security Features
1. **Connection Rejection**: Unauthenticated or expired tokens reject the socket connection during the handshake (`AUTH_INVALID`, `AUTH_EXPIRED`).
2. **Per-Event Membership Guard**: Handlers never trust client-provided `conversationId` without calling `requireMember()`. If a user was removed from a group, their events are immediately rejected with `CONVERSATION_ACCESS_DENIED`.
3. **Room Isolation**: Broadcasts use canonical rooms (`conversation:{id}` and `user:{userId}`) to prevent message leakage.
4. **Parameter Sanitization**: All database queries executed by handlers use positional parameters (`$1, $2, ...`) via the PostgreSQL wire protocol.

---

## 3. Real-Time Socket Events Specification

### Inbound Events (Client -> Server)

| Event Name | Emitted By | Payload | Description & Validation | Ack Response |
| :--- | :--- | :--- | :--- | :--- |
| `conversation:join` | Authenticated member | `{ conversationId: string }` | Joins socket to `conversation:{id}` room. Verifies active membership. | `{ ok: true, conversationId }` or `{ ok: false, code }` |
| `conversation:leave`| Authenticated member | `{ conversationId: string }` | Leaves socket room `conversation:{id}`. | `{ ok: true, conversationId }` |
| `message:send` | Conversation member | `{ conversationId: string, clientMessageId: string, content: string }` | Saves message, triggers delivery receipts, cancels typing. Deduplicates on `(senderId, clientMessageId)`. | `{ ok: true, message: MessageObject }` |
| `message:edit` | Message author | `{ conversationId: string, messageId: string, content: string }` | Edits message content. Enforces **10-minute edit window** and author ownership. | `{ ok: true, message: MessageObject }` |
| `message:delete` | Message author | `{ conversationId: string, messageId: string }` | Soft-deletes message (`deleted_at = NOW()`). Enforces **10-minute window**. | `{ ok: true, messageId, deletedAt }` |
| `message:delivered`| Message recipient | `{ messageId: string }` | Records delivery timestamp for incoming message. | — |
| `conversation:read` | Conversation member | `{ conversationId: string, messageId: string }` | Moves user's read cursor up to `messageId`. Updates receipts and unread counts. | `{ ok: true, readCount: number }` |
| `typing:start` | Conversation member | `{ conversationId: string }` | Notifies room that user started typing. Refreshes in-memory 3s TTL. | — |
| `typing:stop` | Conversation member | `{ conversationId: string }` | Clears in-memory typing state and notifies room. | — |
| `reaction:add` | Conversation member | `{ conversationId: string, messageId: string, emoji: string }` | Upserts emoji reaction. | `{ ok: true, messageId, emoji }` |
| `reaction:remove` | Conversation member | `{ conversationId: string, messageId: string, emoji: string }` | Deletes user's reaction. | `{ ok: true, messageId, emoji }` |

---

### Outbound Events (Server -> Client)

| Event Name | Broadcast Target | Payload | Trigger |
| :--- | :--- | :--- | :--- |
| `message:new` | `conversation:{id}` | `MessageObject` | Emitted when any member sends a new message. |
| `message:edited`| `conversation:{id}` | `{ message: MessageObject }` | Emitted when message author updates content within 10 minutes. |
| `message:deleted`| `conversation:{id}` | `{ conversationId, messageId, deletedAt }` | Emitted when message author deletes message within 10 minutes. |
| `message:receipt`| `conversation:{id}` | `{ messageId, conversationId, userId, deliveredAt?, readAt?, seenCount, recipientCount }` | Emitted on message delivery or read cursor movement. |
| `unread:update` | `user:{recipientId}` | `{ conversationId: string, unreadCount: number }` | Emitted to update sidebar badge for a recipient. |
| `typing:update` | `conversation:{id}` (excl. sender) | `{ conversationId: string, userId: string, typing: boolean }` | Emitted when a peer starts or stops typing. |
| `reaction:updated`| `conversation:{id}` | `{ messageId, conversationId, userId, emoji, action: "added" \| "removed" }` | Emitted on emoji reaction toggle. |
| `presence:update`| All user's conversation rooms | `{ userId: string, online: boolean, lastSeenAt: string \| null }` | Emitted when a user connects, disconnects, or transitions presence. |

---

## 4. Structured Logging Service

A zero-dependency, colorized logging service ([`utils/logger.js`](src/utils/logger.js)) and request timing middleware ([`middleware/requestLogger.js`](src/middleware/requestLogger.js)) format console output cleanly:

```
[10:32:05.123] [INFO]  Server running on http://localhost:5000
[10:32:05.145] [INFO]  Database connected at 2026-10-01T04:14:06.529Z
[10:32:06.890] [HTTP]  POST   /api/auth/refresh 401 1.8ms - Refresh token required
[10:32:06.891] [WARN]  API [POST /api/auth/refresh] 401 - Refresh token required
[10:32:07.102] [HTTP]  GET    /api/health 200 0.8ms
```

### Log Levels & Rules:
- **`logger.http`**: Automatically logs method, route, color-coded HTTP status code (2xx green, 3xx cyan, 4xx yellow, 5xx red), and execution duration in milliseconds.
- **Operational Client Errors (400–499)**: Logged cleanly as `[WARN]` with method, path, and error message, suppressing useless Node.js router stack traces.
- **Internal Server Errors (500+)**: Logged as `[ERROR]` with full call stack trace in dim formatting for rapid debugging.
- **`logger.info` & `logger.warn`**: Standard timestamped application events.

---

## 5. Known Backend Limitations & Trade-offs

1. **Single-Node In-Memory Presence & Typing**:
   - *Design*: `presenceManager.js` and `typingManager.js` maintain active socket tracking in Node.js process memory for sub-millisecond response times.
   - *Trade-off*: Running multiple backend instances behind a load balancer requires a Redis Pub/Sub adapter (`@socket.io/redis-adapter`) to synchronize typing and presence states across processes.
2. **Hard Database-Level 10-Minute Limit**:
   - *Design*: Message edits and deletes enforce `created_at >= NOW() - INTERVAL '10 minutes'` atomically in PostgreSQL.
   - *Trade-off*: Clocks must be synchronized via NTP on database and server hosts to prevent edge-case timing drifts.
3. **Soft Message Deletions**:
   - *Design*: Deletions set `deleted_at = NOW()` and preserve metadata to ensure replica sync and avoid broken read receipts.
   - *Trade-off*: Message content is redacted to `"[This message was deleted]"` for clients, but message rows persist in storage unless pruned via a retention batch job.
