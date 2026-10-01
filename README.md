# GrekMessenger

A real-time messaging application with direct (1:1) and group messaging, cursor-based pagination, delivery & read receipts, live typing indicators, emoji reactions, presence tracking, and role-based access control.

---

## 📑 Documentation Index

- **[Database Schema & Indexing](database/README.md)**: Tables, foreign keys, composite indexes, and performance rationale.
- **[Backend & Socket Events](server/README.md)**: Gateway setup, all inbound/outbound socket events, authorization architecture, and REST API.
- **[Frontend Architecture](client/README.md)**: Vite + React setup, container vs. dumb components, custom hooks, and state synchronization.

---

## 🚀 Quickstart & Setup

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: v14.0 or higher running on port `5432`

---

### 2. Database Setup
Ensure PostgreSQL is running, then create the database:
```sql
CREATE DATABASE grek_messenger;
```

---

### 3. Backend Setup
1. Navigate to `/server`:
   ```bash
   cd server
   ```
2. Configure `.env`:
   ```env
   PORT=5000
   NODE_ENV=development
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/grek_messenger
   JWT_ACCESS_SECRET=super_secret_access_token_key_min_32_chars
   JWT_REFRESH_SECRET=super_secret_refresh_token_key_min_32_chars
   JWT_ACCESS_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   CLIENT_URL=http://localhost:5173
   ```
3. Install dependencies and apply migrations:
   ```bash
   npm install
   npm run migrate
   ```
4. (Optional) Seed demo users:
   ```bash
   npm run seed
   ```
5. Start backend development server:
   ```bash
   npm run dev
   ```
   *The backend will be running at `http://localhost:5000`.*

---

### 4. Frontend Setup
1. Open a new terminal and navigate to `/client`:
   ```bash
   cd client
   ```
2. Configure `.env`:
   ```env
   VITE_API_URL=http://localhost:5000/api
   VITE_SOCKET_URL=http://localhost:5000
   ```
3. Install dependencies and start development server:
   ```bash
   npm install
   npm run dev
   ```
   *The frontend will be available at `http://localhost:5173`.*

---

## 🗄️ Database Schema & Rationale

Detailed specifications can be found in the **[Database README](database/README.md)**.

```
users (id, email, password_hash, name, avatar_url, last_seen_at)
  │
  ├── refresh_tokens (id, user_id, token_hash, expires_at, revoked_at)
  ├── conversations (id, type, name, avatar_url, direct_key, created_by)
  ├── conversation_members (conversation_id, user_id, role, last_read_message_id, removed_at)
  └── messages (id, conversation_id, sender_id, client_message_id, content, created_at, deleted_at)
        ├── message_receipts (message_id, user_id, delivered_at, read_at)
        └── message_reactions (message_id, user_id, emoji)
```

### Core Design Decisions:
- **Composite Keyset Pagination Index** (`conversation_id, created_at DESC, id DESC`): Avoids slow `OFFSET` scanning for long message histories.
- **Partial Unique Index** (`direct_key WHERE type = 'DIRECT'`): Guarantees that only one direct chat can exist between two users, preventing duplicate direct conversations under concurrent creation.
- **10-Minute Guard**: Edits and soft deletes enforce `created_at >= NOW() - INTERVAL '10 minutes'` atomically in PostgreSQL queries.
- **Zero SQL Injection**: All queries use parameterized inputs (`$1, $2, ...`) via `node-postgres` prepared statements.

---

## ⚡ Real-Time Socket Events Summary

Full event payloads and contracts can be found in the **[Server README](server/README.md)**.

### Inbound Events (Client -> Server)
- `conversation:join` — Join real-time room for active conversation.
- `conversation:leave` — Leave real-time room.
- `message:send` — Send message with client-side deduplication UUID.
- `message:edit` — Edit own message (strictly within 10 minutes).
- `message:delete` — Soft-delete own message (strictly within 10 minutes).
- `message:delivered` — Acknowledge message receipt on recipient client.
- `conversation:read` — Advance read watermark up to a message ID.
- `typing:start` / `typing:stop` — Broadcast typing indicators with auto-refresh.
- `reaction:add` / `reaction:remove` — Toggle emoji reaction on a message.

### Outbound Broadcasts (Server -> Client)
- `message:new` — Dispatches message to conversation members.
- `message:edited` / `message:deleted` — Dispatches content updates to conversation.
- `message:receipt` — Updates read/delivered checkmarks and group seen counts.
- `unread:update` — Updates unread badges for offline/background conversations.
- `typing:update` — Live typing notifications for peer users.
- `reaction:updated` — Live emoji reaction count and user updates.
- `presence:update` — Live online / last-seen transitions.

---

## 🔒 Socket Authorization

1. **Handshake Token Verification**: Every socket connection sends `socket.auth = { token }`, verified against `JWT_ACCESS_SECRET`.
2. **Auto-Disconnect on Expiry**: Tokens are evaluated on connect, and an auto-disconnect timer is scheduled for token expiry.
3. **Per-Action Authorization**: Every socket handler checks `requireMember({ conversationId, userId })` against the database before executing the action.
4. **Room-Scoped Messaging**: Broadcasts are scoped to `conversation:{id}` or `user:{id}` rooms.

---

## ⚖️ Known Limitations & Trade-offs

| Area | Decision / Trade-off | Rationale |
| :--- | :--- | :--- |
| **Scaling** | In-memory Socket.IO state (typing & presence) | Optimized for single-server low latency. Horizontal multi-node scaling requires adding `@socket.io/redis-adapter`. |
| **Edit/Delete** | Hard 10-minute database window | Balances user correction flexibility with chat history immutability. |
| **File Storage** | Text & Emojis with URL avatar references | Keeps the storage layer focused on real-time messaging without S3/blob dependencies. |
| **Message History** | Soft deletion (`deleted_at = NOW()`) | Preserves database integrity for read receipts and pagination cursors while scrubbing content. |
| **Architecture** | Presentational ("Dumb") Components | UI components contain zero API/socket imports; all business logic is isolated into custom React hooks. |
