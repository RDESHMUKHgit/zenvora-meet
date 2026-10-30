# RD Video Meet

A production-oriented, scalable video meeting web application built with a modern React + TypeScript frontend and a Node.js + Express + TypeScript backend.

---

## Architecture Overview

The repository is structured into two completely independent applications:

- **`client/`**: Modern Single Page Application (SPA) powered by React 19, Vite, and TypeScript. Styled using Ant Design and Lucide icons, with centralized API services, route definitions, and domain-based module boundaries.
- **`server/`**: Robust HTTP & WebSocket backend running Node.js, Express, Socket.IO, Neon PostgreSQL, and Drizzle ORM. Follows strict separation of concerns with layered controllers, services, repositories, validators, middlewares, and centralized error handling.

---

## Database Architecture (PostgreSQL & Drizzle ORM)

The database schema is managed via Drizzle ORM and deployed to **Neon PostgreSQL** (serverless pooled connection). All timestamps are stored with timezone awareness (`timestamp with time zone`) and manipulated using the modern **Temporal API** (`@js-temporal/polyfill`).

### Core Tables

1. **`users`**:
   - `id`: UUID (Primary Key, generated via `gen_random_uuid()`)
   - `name`: Full user display name
   - `email`: Unique email address (indexed)
   - `password_hash`: Argon2id hashed password
   - `avatar_url`: User avatar link (nullable)
   - `created_at`: Timezone-aware creation timestamp
   - `updated_at`: Timezone-aware modification timestamp

2. **`auth_sessions`**:
   - `id`: UUID (Primary Key)
   - `user_id`: Foreign key referencing `users.id` (`ON DELETE CASCADE`)
   - `token_hash`: SHA-256 hash of the 64-character random session token (indexed, unique)
   - `expires_at`: Session expiration timestamp (indexed)
   - `created_at`: Creation timestamp
   - `last_activity_at`: Last recorded activity timestamp

3. **`meetings`**:
   - `id`: UUID (Primary Key)
   - `meeting_code`: Unique room code e.g. `rdm-abc-xyz` (indexed, unique)
   - `host_user_id`: Foreign key referencing `users.id` (`ON DELETE SET NULL`, nullable for ephemeral rooms)
   - `title`: Meeting topic/title
   - `max_participants`: Participant room limit (default: 50)
   - `is_ephemeral`: Ephemeral room flag (default: false)
   - `status`: Room status (`scheduled`, `active`, `ended`)
   - `created_at`, `started_at`, `ended_at`, `expires_at`: Timestamps

4. **`meeting_participants`**:
   - `id`: UUID (Primary Key)
   - `meeting_id`: Foreign key referencing `meetings.id` (`ON DELETE CASCADE`)
   - `user_id`: Foreign key referencing `users.id` (`ON DELETE SET NULL`, nullable)
   - `display_name`: Display name within the call
   - `role`: Role (`host`, `co-host`, `participant`)
   - `joined_at`, `left_at`: Join/leave timestamps

5. **`conversations`**:
   - `id`: UUID (Primary Key)
   - `meeting_id`: Foreign key referencing `meetings.id` (`ON DELETE CASCADE`)
   - `conversation_type`: Type (`meeting_main`, `direct`)
   - `created_at`: Creation timestamp

6. **`conversation_members`**:
   - `id`: UUID (Primary Key)
   - `conversation_id`: Foreign key referencing `conversations.id` (`ON DELETE CASCADE`)
   - `user_id`: Foreign key referencing `users.id`
   - `participant_id`: Foreign key referencing `meeting_participants.id`

7. **`attachments`**:
   - `id`: UUID (Primary Key)
   - `uploader_user_id`: Foreign key referencing `users.id`
   - `uploader_participant_id`: Foreign key referencing `meeting_participants.id`
   - `storage_provider`, `storage_public_id`, `original_file_name`, `mime_type`, `size_bytes`, `resource_url`, `created_at`

8. **`messages`**:
   - `id`: UUID (Primary Key)
   - `conversation_id`: Foreign key referencing `conversations.id` (`ON DELETE CASCADE`)
   - `sender_user_id`: Foreign key referencing `users.id`
   - `sender_participant_id`: Foreign key referencing `meeting_participants.id`
   - `message_type`: Type (`text`, `attachment`, `system`)
   - `content`: Text content
   - `attachment_id`: Foreign key referencing `attachments.id` (`ON DELETE SET NULL`)
   - `created_at`, `edited_at`, `deleted_at`: Timestamps

9. **`message_reads`**:
   - `id`: UUID (Primary Key)
   - `message_id`: Foreign key referencing `messages.id` (`ON DELETE CASCADE`)
   - `reader_user_id`, `reader_participant_id`: Reader references
   - `read_at`: Read timestamp

10. **`message_reactions`**:
    - `id`: UUID (Primary Key)
    - `message_id`: Foreign key referencing `messages.id` (`ON DELETE CASCADE`)
    - `user_id`, `participant_id`: Reactor references
    - `emoji`: Reaction emoji character
    - `created_at`: Timestamp

---

## Authentication System

A custom, secure authentication system designed specifically for video collaboration without external auth vendors:

- **Password Hashing**: **Argon2id** (`argon2.argon2id`) with customized memory and time cost.
- **Session Tokens**: Generated with 32 bytes of cryptographically secure randomness (`crypto.randomBytes(32)`).
- **Hashed Sessions in PostgreSQL**: Only the **SHA-256 hash** of the session token is persisted in `auth_sessions`. Even in the event of database access leakage, raw session tokens cannot be recovered.
- **Cookies**:
  - `session_token`: `HttpOnly`, `SameSite=Lax`, `Secure` (in production), 7-day expiration.
  - `csrf_token`: `SameSite=Lax`, `Secure` (in production).
- **Session Rotation**: On login, previous user sessions are rotated/revoked and a new session token is issued.
- **Session Revocation**: On logout, the token hash is permanently deleted from PostgreSQL and the cookie is cleared.
- **CSRF Defense**: Double-submit cookie pattern combined with strict origin header verification.
- **Account Enumeration Defense**: Generic login error messages (`"Invalid email or password"`) for both missing accounts and incorrect passwords.
- **Rate Limiting**: Dedicated rate limiter (`authRateLimiter`) on login and registration (15 requests / 15 minutes).

### API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user account & establish session | No |
| `POST` | `/api/auth/login` | Authenticate user & issue new session cookie | No |
| `POST` | `/api/auth/logout` | Revoke active session & clear cookies | Yes (Cookie / Bearer) |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Yes (Cookie / Bearer) |
| `GET` | `/api/auth/csrf` | Issue or refresh client CSRF token | No |
| `GET` | `/api/health` | Health-check with uptime & Temporal ISO timestamp | No |

---

## Environment Variables

### Server (`server/.env`)
```bash
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://neondb_owner:npg_...pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
LOG_LEVEL=info
```

### Client (`client/.env`)
```bash
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## Database Migrations

### Generate New Migrations
Inspects schema files in `server/src/db/schema/` and generates SQL migration files:
```bash
npm --prefix server run db:generate
```

### Apply Migrations to Neon DB
Executes pending migration files against the Neon PostgreSQL database:
```bash
npm --prefix server run db:migrate
```

### Direct Push (Schema sync)
```bash
npm --prefix server run db:push
```

### Launch Drizzle Studio
Launches interactive visual database browser:
```bash
npm --prefix server run db:studio
```

---

## Testing & Verification

Run the full automated authentication integration test suite (covers registration, login, session cookies, current user, duplicate registration, invalid credentials, logout revocation, and Temporal API session expiration):

```bash
npm run test:auth
```

All 10 integration test stages run against an ephemeral server and the live Neon database with automatic cleanup.

### Development Commands

```bash
# Run both frontend and backend concurrently
npm run dev

# Run backend only (with tsx watch)
npm run dev:server

# Run frontend only (Vite)
npm run dev:client

# Full build (Server tsc + Client Vite)
npm run build

# ESLint check
npm run lint

# Prettier format
npm run format
```
