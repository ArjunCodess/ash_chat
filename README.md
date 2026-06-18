<p align="center">
  <img width="750" src="https://ash-chat.vercel.app/app.png" alt="ash_chat app preview">
</p>

<h2 align="center">ash_chat - Private, Temporary Chat Rooms</h2>

<p align="center">
  Create a temporary two-person chat room, share the room link, and let the room expire automatically. ash_chat is built around short-lived conversations, anonymous identities, HTTP-only participant tokens, Redis-backed room state, and realtime updates.
</p>

## Table of Contents

- [About](#about)
- [Getting Started](#getting_started)
- [Usage](#usage)
- [Built Using](#built_using)
- [Deployment](#deployment)
- [Threat Model](#threat_model)
- [Author](#authors)
- [Acknowledgments](#acknowledgement)

## About <a name = "about"></a>

ash_chat is a lightweight chat app for private, temporary two-person rooms. A user creates a room with a time-to-live, shares the room URL with one other person, and messages are stored only until the room expires or is destroyed.

The app uses Redis for room state, participant membership, message storage, rate-limit counters, and room expiration. Realtime updates are delivered through Upstash Realtime, while the API layer is built with Elysia and consumed through Eden for typed client calls.

The current security model focuses on temporary room access and abuse resistance. Rooms validate their IDs before Redis lookups, participant access is enforced through an HTTP-only token cookie, and message/room creation endpoints have Redis-backed rate limits.

## Getting Started <a name = "getting_started"></a>

Want to run ash_chat locally? Here's what you need.

### What You Need First

- Node.js 20 or newer
- pnpm
- Upstash Redis REST database
- Upstash Realtime support using the same Redis project

### Getting It Running

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Set up your environment**

   Create `.env.local` in the root directory:

   ```env
   UPSTASH_REDIS_REST_URL=
   UPSTASH_REDIS_REST_TOKEN=
   ```

3. **Start the development server**

   ```bash
   pnpm dev
   ```

4. **Open the app**

   Visit `http://localhost:3000`.

## Usage <a name = "usage"></a>

### What It Does

1. **Create Temporary Rooms**
   - Choose a room TTL in seconds
   - Server validates TTL bounds before creating the room
   - Room state is stored in Redis with expiry

2. **Join With a Room Link**
   - Room URLs are guarded by `proxy.ts`
   - Room IDs are validated before Redis lookups
   - A room accepts up to two participants
   - Participants receive an HTTP-only token cookie

3. **Chat in Realtime**
   - Messages are stored in Redis while the room exists
   - Upstash Realtime notifies connected clients
   - The UI refreshes messages when realtime events arrive

4. **Destroy or Expire**
   - A participant can destroy the room manually
   - Redis TTL automatically expires room and message state
   - Other participants are redirected when destroy events arrive

5. **Abuse Protection**
   - Room creation is rate-limited per client IP
   - Message sending is rate-limited per room participant
   - Rooms have a maximum stored message count
   - Message and room schemas are centralized in `lib/schema.ts`

### Current Limits

- Room creation: `10` rooms per minute per client IP
- Message burst: `12` messages per `10` seconds per room participant
- Message hourly cap: `240` messages per hour per room participant
- Room storage cap: `500` messages
- Room TTL: `60` to `86400` seconds
- Participants per room: `2`

## Built Using <a name = "built_using"></a>

### Core Framework

- **Next.js 16** with App Router
- **React 19** for the user interface
- **TypeScript** for type safety
- **Tailwind CSS** for styling

### API and Realtime

- **Elysia** for API route composition
- **Eden** for typed client calls
- **Upstash Realtime** for room events
- **Zod** for shared runtime schemas

### Storage

- **Upstash Redis** for rooms, messages, participant lists, TTLs, and rate-limit counters

### Development Tools

- **ESLint** for code quality
- **pnpm** for package management
- **Turbopack** through Next.js builds

## Deployment <a name = "deployment"></a>

This app can deploy to any Node-compatible Next.js host.

### Getting It Live

1. **Configure environment variables**

   ```env
   UPSTASH_REDIS_REST_URL=
   UPSTASH_REDIS_REST_TOKEN=
   ```

2. **Build before deployment**

   ```bash
   pnpm lint
   pnpm build
   ```

3. **Deploy**

   Connect the repository to your hosting provider and set the environment variables in the provider dashboard.

4. **Use HTTPS**

   Production deployments should run over HTTPS so participant cookies are marked secure.

## Threat Model <a name = "threat_model"></a>

### Protected Assets

- Room existence and access
- Participant token cookies
- Message contents stored in Redis
- Redis credentials

### Primary Controls

- HTTP-only participant token cookie
- Two-participant room cap
- Room TTL expiration
- Server-side room ID validation
- Redis-backed rate limiting
- Centralized schema validation

### Known Limitations

- Messages are currently stored server-side in plaintext. This is not true end-to-end encryption yet.
- Participant names are client-provided and should not be treated as trusted identity.
- Anyone with a valid room URL can join before the room reaches the participant cap.
- Participant joins should eventually become atomic to avoid race conditions at the two-user boundary.

### Future Hardening

- Client-side encryption with room keys kept out of Redis
- Atomic participant joins
- Stronger trusted-proxy handling for client IP rate limits
- Security headers and CSP
- Better audit logging for rejected room/message activity

## Author <a name = "authors"></a>

Built by the ash_chat project author.

## Acknowledgments <a name = "acknowledgement"></a>

- **Next.js** for the application framework
- **Elysia** for the API layer
- **Upstash** for Redis and Realtime infrastructure
- **Zod** for schema validation
- **nanoid** for compact secure IDs

---

<div align="center">

**ash_chat** - Temporary rooms for short-lived conversations.

</div>
