<!-- f0584d56-1940-4426-90c1-c78f319847f0 1d838b2e-1257-4a73-9ef7-61d7ab64f556 -->
# Cloud Functions → Server Migration Plan

## Conventions (follow existing `users`, `venues`, `conversations`)
- **Auth**: Use `requireAuth` middleware for protected endpoints.
- **Response**: Return `{ data: ... }` envelope; map errors to appropriate HTTP status with `{ error, message }`.
- **Routes**: Mount under `/api/<category>/<action>` (POST unless GET is clearly read-only).
- **Server structure**: Add files under `gigin-api/routes/<category>/<file>.js`; export an Express `router`.
- **Client**: Create helpers in `src/services/api/<category>.js` using `post('/<category>/<action>')` via `src/services/http`.
- **Inputs/outputs**: Match existing component expectations; adapt payload shape minimally and keep `{ data }` envelope.

## Pre-flight
- Confirm `.env` has `VITE_API_URL` (or `VITE_API_BASE_URL`) used by `src/services/http`.
- Ensure CI workflow deploys `feature/server-migration` (already present).

## A. Fix existing routes (venues, conversations)
- Align payload validation, error codes, and `{ data }` responses.
- Verify client helpers in `src/services/api/venues.js` and `src/services/api/conversations.js` match server contract.
- Smoke-test affected components: venue membership/invites and conversation creation/update flows.

## B. Migrate categories (order below)
For each category below:
1) Copy callable logic → `gigin-api/routes/<category>/<file>.js` with Express handlers.
2) Mount router in `gigin-api/server.js` under `/api/<category>`.
3) Implement `src/services/api/<category>.js` with helpers per endpoint.
4) Update all `.jsx` imports to use `src/services/api/<category>.js` helpers.
5) Verify inputs/outputs vs. consuming components; adjust helpers accordingly.
6) Minimal endpoint tests with sample payloads.

### 1) messages
- Port callable sends/updates to `/api/messages/...`.
- Ensure message send validates `senderId === req.auth.uid` and timestamps via Admin SDK.

### 2) gigs
- Move gig creation/update/apply/confirm related callables.
- Guard venue/musician permissions server-side.

### 3) musicians
- Profile create/update, eligibility checks, and lookups.

### 4) bands
- Band create/update/membership operations.

### 5) billing (callables only)
- Customer retrieval/create, ephemeral keys, payment intents (callable forms only).
- Exclude HTTP/webhook/scheduled logic from this phase.

### 6) reviews
- Create/retrieve reviews, permission checks.

### 7) media
- Upload tokens/urls generation and metadata writes applicable to callable usage.

### 8) messaging (callables only)
- Only migrate `cancelCloudTask`-style callable to server route that cancels a task; leave HTTP Task producers/consumers as-is.