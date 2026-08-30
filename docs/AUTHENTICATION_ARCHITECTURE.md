# Dice Arena Authentication Architecture v1.1

**Status:** Proposed. Ready for review. Not implemented.

## Executive Summary

Dice Arena requires a user authentication system to establish trusted user identity before multiplayer gameplay expands. This architecture designs the authentication boundary.

**Selected approach:** Self-hosted passwordless email authentication (magic links) for v1, with clear socket for future optional OIDC identities (Google, Apple, etc.). Internal Dice Arena user IDs decouple from provider identities. Bearer token session model with short-lived access tokens and revocable refresh sessions.

The authenticated design evolves the existing `POST /matches` endpoint, changing its contract from trusting two client-supplied user IDs to deriving player A from the authenticated caller and accepting only the opponent ID from the request.

---

## 1. Canonical Architecture Invariants

These invariants drive all decisions below:

1. **Game-domain never sees authentication provider concepts.** Application uses internal Dice Arena user IDs only.
2. **External identities (email, OAuth subjects) map to internal users at the authentication boundary.** Domain logic remains provider-independent.
3. **Login challenges, access tokens, and refresh sessions are distinct credentials with separate threat models.** Do not conflate their lifecycles.
4. **Refresh credentials are revocable and rotatable.** Session invalidation prevents replay.
5. **Long-lived refresh credentials use secure mobile storage.** Short-lived access tokens may use memory.
6. **Raw tokens and challenge secrets never appear in logs.** Sanitize all security event logging.
7. **POST /matches derives player A from authenticated caller.** Client cannot impersonate another player A.
8. **Authentication and authorization remain separate.** Different error codes, different enforcement layers.
9. **Provider-specific email/OIDC logic sits behind server-owned authentication ports.** Application sees only userId.
10. **Account deletion must preserve legitimate persistence integrity per privacy policy.** Do not destroy all match history carelessly.
11. **Email enumeration resistance is mandatory.** Public responses must not reveal account existence.
12. **Access tokens carry minimal standard claims:** sub, sid, iat, exp, iss, aud. No email, provider, or profile data. The application authentication context maps `sub` to internal `userId` and `sid` to internal `sessionId`.

---

## 2. Context

### Current State

- `POST /matches` exists, trusts `playerAUserId` and `playerBUserId` from transport
- No authentication layer
- Minimal `users` table: id (UUID), displayName, status, createdAt, updatedAt
- No external identity mapping or token mechanism
- PostgreSQL is authoritative
- Server: Fastify + Drizzle ORM + postgres.js
- Mobile: Expo 57 (React Native)

### Design Scope

This document specifies:

- External identity → internal user ID mapping strategy
- Three distinct credential types and their roles
- Token lifecycle and revocation semantics
- Mobile secure storage requirements
- Magic link deep linking and email security
- POST /matches contract evolution
- Authentication and authorization separation
- Self-hosting requirements and email delivery boundary

Does NOT implement: code, dependencies, schema, migrations, or persistence design (separate task).

---

## 3. Credential Types (Distinct Models)

### A. Login Challenge (Magic Link)

**Purpose:** Prove control of email address; authorize one authentication attempt.

**Properties:**

- Single-purpose, one-time use, very short-lived (recommended initial: 15 min)
- Replay-protected and tamper-resistant
- Server-side state or verifiable token structure
- Marked consumed after successful verification
- Never passed as access/refresh token; never stored in refresh storage

**Threat model:** Leaked challenge expires quickly. Prefetch/scanning is a known risk (see section 12.5).

**Example flow:**

```
1. POST /auth/magic-link { email: "user@example.com" }
2. Server generates challenge token, sends link: https://app.example.com/auth?challenge=xyz123
3. User clicks or app navigates
4. POST /auth/verify { challenge: "xyz123" }
5. Server validates, marks consumed, returns {accessToken, refreshToken}
```

### B. Access Token (Bearer)

**Purpose:** Authorize ordinary authenticated API calls.

**Properties:**

- Short-lived; an initial recommendation is 15 minutes, but exact lifetime is policy-configurable
- Bearer credential in Authorization header
- Minimal standard claims: `sub`, `sid`, `iat`, `exp`, `iss`, `aud`
- No email, provider, or profile data
- Stateless verification via cryptographic signature
- Lost on app restart if stored in memory
- Application authentication context maps `sub` → internal `userId` and `sid` → internal `sessionId`

**Threat model:** Stolen token used until expiry or server revocation. Short lifetime limits damage. Refresh credential compromise is more dangerous.

### C. Refresh Credential + Server Session

**Purpose:** Obtain new access tokens over a longer authenticated session.

**Terms:**

- **Refresh credential:** opaque client-held value, stored on mobile
- **Server session:** authoritative record for the authenticated session, stored by the server
- **Refresh verifier/hash:** server-side representation used to validate rotation and revoke the session

**Properties:**

- Substantially longer-lived; an initial recommendation is 7 days, but exact lifetime is policy-configurable
- Revocable by invalidating the server-side session record
- Rotatable: each refresh returns a new refresh credential, old one invalidated
- Stored on mobile in Expo SecureStore (OS-encrypted)
- Server stores a hash or equivalent safe verifier for the refresh credential
- Replay protection through rotation and family tracking

**Threat model:** Stolen refresh credential grants persistent access for a longer window. Rotation and revocation are primary mitigations.

---

## 4. Authentication Approaches (Summary)

Five approaches evaluated. Hybrid (magic links + OIDC socket) selected.

| Approach          | v1 Implementation              | Vendor Lock-In                       | Self-Hosting |
| ----------------- | ------------------------------ | ------------------------------------ | ------------ |
| A: Email/password | Dice Arena manages credentials | None                                 | ✓ Yes        |
| B: Magic links    | One-time email links           | None (if email provider independent) | ✓ Yes        |
| C: Social OAuth   | Google/Apple sign-in           | Medium (provider-dependent)          | ⚠ Partial    |
| D: Managed auth   | Auth0, Clerk, Firebase         | High                                 | ✗ No         |
| **E: Hybrid**     | **Magic links, OAuth socket**  | **None (provider optional)**         | **✓ Yes**    |

**Selected: E (Hybrid).** Magic links v1 require no external auth provider and support self-hosting. Future OAuth integration is pluggable without re-architecting.

---

## 5. POST /matches Evolution

### Current (Unauthenticated)

```json
POST /matches
{
  "playerAUserId": "uuid-a",
  "playerBUserId": "uuid-b"
}
```

### After Authentication Integration

```json
POST /matches
Authorization: Bearer <accessToken>
{
  "opponentUserId": "uuid-b"
}
```

**Server derives:**

- `playerAUserId` = authenticated caller's internal Dice Arena user ID (from token)
- `playerBUserId` = opponentUserId (from request)

**No legacy unauthenticated endpoint.** This is a breaking change intentionally applied before public product guarantees. Once clients are authenticated, the transport changes with them.

---

## 6. CreateMatch Authorization Rule

**Least privilege:**

- Authenticated caller is always player A (match creator)
- Request supplies only `opponentUserId`
- Server resolves both player IDs
- Caller cannot create matches between two unrelated users
- Caller cannot impersonate another player A

Admin/service account creation is a future concern and should not be built into normal CreateMatch semantics.

---

## 7. Route Classification

### Public (No Authentication Required)

These must be reachable before any authentication exists:

- `POST /auth/magic-link` — Request magic link via email
- `POST /auth/verify` — Verify magic link, exchange for tokens
- `GET /health` — Service health

### Credential/Session Management

Logically distinct from fully public:

- `POST /auth/refresh` — Exchange valid refresh credential for new access token (requires valid refresh session)
- `POST /auth/logout` — Revoke refresh credential

### Protected (Authentication Required)

- `POST /matches` — Create match (authenticated caller is player A)
- `GET /matches/:id` — Get match details
- `POST /matches/:id/actions` — Submit game action (roll, score, etc.)
- `GET /user/profile` — Get authenticated user's profile
- `PATCH /user/profile` — Update profile
- `DELETE /user` — Request account deletion

---

## 8. Token Signing: Symmetric (HS256) Recommended for v1

**Decision:** Use HMAC-SHA256 (HS256) symmetric signing for v1.

**Rationale:**

- Single self-hosted server needs no distributed key management
- Simpler to rotate secrets if needed
- Adequate for current scope

**Future migration:** As infrastructure scales (multiple servers, public token verification endpoints), asymmetric (RS256) becomes simpler:

- Public key can be distributed freely
- Private key never leaves auth service
- No key synchronization needed across services

**Implementation detail:** Keep signature algorithm configurable in code. No architectural re-design required to migrate; just update algorithm and key distribution method.

---

## 9. Access Token Claims (Minimal)

**Canonical JWT claims:**

```json
{
  "sub": "user-uuid",
  "sid": "session-id",
  "iat": 1693483200,
  "exp": 1693484100,
  "iss": "https://dice-arena.example.com",
  "aud": "dice-arena-api"
}
```

**Standard semantics:**

- `sub` = internal Dice Arena user ID
- `sid` = Dice Arena session ID
- `iat` = issued-at timestamp
- `exp` = expiration timestamp
- `iss` = issuer identifier
- `aud` = audience identifier

**Application mapping:**

- `sub` → internal `userId`
- `sid` → internal `sessionId`

The application may then treat authentication context as server-owned concepts such as `request.authenticatedUser.userId` and `request.authenticatedUser.sessionId` without keeping provider or profile data in the token itself.

**Do NOT include by default:**

- email
- displayName
- authProvider / providerSubject
- profile information
- roles (authorization is separate)

**Benefit of minimization:**

- Reduces privacy exposure if token is logged/leaked
- Avoids stale identity data in distributed sessions
- Decouples from provider details
- Keeps token size small
- Application can load full user profile from dedicated endpoint if needed

**Implementation:** If a route legitimately needs email (e.g., account settings), load it via separate authenticated call to `GET /user/profile`.

---

## 10. Session Revocation Semantics

**Clear trade-off:**

**Access tokens:** Short-lived; an initial recommendation is 15 minutes, but exact lifetime is policy-configurable. After issuance, they remain valid until expiry unless the server performs additional revocation checks.

**Refresh sessions:** Revoked immediately by deleting the server-side session record. Future refresh-credential submissions fail because the session no longer exists.

**Immediate logout everywhere:** Requires one of:

- Per-request access-token revocation lookup (defeats stateless verification)
- Shorter access-token lifetime (e.g., an example default of 5 minutes; tradeoff: more refresh requests)
- Token versioning/session revocation cache (future enhancement)

**v1 strategy:** Refresh-session revocation (via logout endpoint) prevents future access-token renewal. Already-issued access tokens may remain valid until natural expiry. Short access-token lifetime bounds this exposure.

**Sensitive operations** (future): Route handlers may perform supplementary revocation checks (e.g., verify user account is still active) if needed.

---

## 11. Mobile Secure Storage Model

### Refresh Token (Persistent, Sensitive)

Store in **Expo SecureStore:**

```typescript
import * as SecureStore from 'expo-secure-store';
await SecureStore.setItemAsync('refreshToken', tokenValue);
const token = await SecureStore.getItemAsync('refreshToken');
```

**Platform delegation:** Expo SecureStore uses OS-provided credential storage (iOS Keychain, Android EncryptedSharedPreferences). Do not assert exact native backing unless verified; document delegation instead.

**Persistence:** Survives app restart; lost if user uninstalls without backup.

### Access Token (Ephemeral, Shorter-Lived)

Store in **application memory only:**

```typescript
let accessToken: string | null = null;
// After login
accessToken = response.accessToken;
// On app suspension/restart
accessToken = null;
```

**No persistent storage.** Lost on app close. Low risk if 15-min lifetime.

### Session Recovery

On app restart:

1. Check for valid `refreshToken` in SecureStore
2. If present: call `POST /auth/refresh` to obtain new `accessToken`
3. If absent: user must re-authenticate via magic link
4. Failed refresh returns 401; user navigates to login

---

## 12. Magic Link Deep Linking (Mobile Security)

### Email to App Flow

```
1. User enters email → POST /auth/magic-link
2. Server generates challenge token
3. Server queues email with magic link:
   https://app.example.com/auth?challenge=abc123&nonce=xyz789
   (OR: dice-arena://auth?challenge=abc123)

4. User opens email, clicks link
5. Depending on app installation:
   - App installed: deep link opens app, challenge extracted
   - App not installed: falls back to web page
   - Browser mail scanner: prefetches URL (RISK - see section 12.5)

6. App has challenge token
7. User taps "Verify" or auto-verify button
8. POST /auth/verify { challenge: "abc123" }
9. Server validates challenge:
   - Check existence
   - Check not yet consumed
   - Check within TTL
   - Mark consumed
10. Return {accessToken, refreshToken}
11. App stores refreshToken → SecureStore
12. App stores accessToken → memory
13. Navigation to authenticated screens
```

### Key Security Points

- **Challenge only in URL.** Not the access/refresh token.
- **Server validates challenge before issuing credentials.** Link opens UI, but credentials are only issued on explicit /auth/verify request.
- **One-time use:** Challenge marked consumed after successful verification. Replay of same challenge fails.
- **Short TTL:** Challenge valid for 15 minutes (example). Expired challenges rejected.

### Fallback (App Not Installed)

If app is not installed, link may open a website:

- Website extracts challenge from URL
- Website presents verification prompt: "Complete sign-in on your device?"
- User taps button → redirects to `dice-arena://auth-callback?challenge=...` (if app now installed)
- Or: website offers browser-based verification flow (future)

---

## 12.5 Mail Scanner / Link Prefetch Threat

**Threat:** Corporate email security tools or mail service scanners automatically open/prefetch links to check for phishing/malware.

**Risk:** If magic link issuance simply consumes the challenge on GET request, mail scanner could silently consume the login link before user sees it.

**Mitigations:**

1. **Require explicit POST verification:** GET the challenge page (show UI), POST /auth/verify to consume it. Scanner GET does not consume.
2. **Two-step confirmation:** Link opens app/page showing "Tap to confirm" button. Tap fires verification request.
3. **Challenge consumption designed for POST only:** Challenge endpoint accepts GET (returns HTML "verify?"), accepts POST (consumes + returns tokens).
4. **Short TTL:** Even if scanner consumes, legitimate user can re-request magic link within seconds.

**Recommendation:** Use POST-only verification or two-step confirmation for v1. Document this threat as mandatory consideration in Authentication Persistence Design.

---

## 13. Internal User Identity

**Immutable internal ID:**

- Stored as UUID in `users.id`
- Issued at first successful login
- Never changes across account lifetime
- Sole identifier for game-domain operations

**Separation from external identity:**

- Email address may change (future feature)
- OAuth subjects change by provider
- Game history remains bound to internal userId

**Application code:**

```typescript
// App never sees external identity
const userId = request.authenticatedUser.userId; // ← internal UUID
const match = await createMatchUseCase(persistence, {
  playerAUserId: userId,
  playerBUserId: opponentUserId,
});
// ↑ Domain logic uses internal IDs only
```

---

## 14. External Identity Mapping

### Conceptual Structure (Not Schema Yet)

Separate identity table (future design phase):

```
provider (text): 'email', 'google', 'apple', etc.
providerSubject (text): email, OAuth sub, etc.
userId (FK): internal Dice Arena user ID
verified (boolean): identity confirmed
linkedAt (timestamp): when linked to this userId
```

**Unique constraint:** `(provider, providerSubject)` — one internal user per external identity.

**Future account linking:** One userId may have multiple rows (one per provider).

### Email Representation (Design Decision Deferred)

Whether email is:

- `provider = 'email'`, `providerSubject = email`
- Separate email column in users table
- Dedicated email identity model

...is deferred to Authentication Persistence Design v1. Recommendation: normalize email per policy (case-insensitive, domain-specific rules) consistently.

---

## 15. Email Normalization Policy (Mandatory)

**Warning:** Email normalization is subtle and must be defined explicitly before schema implementation.

**Do NOT assume aggressive rewriting:**

- Removing dots (`user.name` → `username`): provider-specific, breaks GMail aliasing
- Stripping plus aliases (`user+tag@example.com` → `user@example.com`): breaks intentional filtering
- Case manipulation (`User@Example.COM`): RFC 5321 allows case sensitivity in local part

**Minimum recommended:**

- Lowercase domain (provider standard): `user@EXAMPLE.COM` → `user@example.com`
- Consistent whitespace trimming
- Invalid character validation per RFC 5321
- Provider-specific rules only if documented and intentional

**Responsibility:** Authentication Persistence Design v1 must resolve and document email normalization before schema implementation.

---

## 16. User Account Status

Current schema defines: ACTIVE, SUSPENDED, DELETED.

**Authentication lifecycle:**

- **ACTIVE:** Normal account. Authentication succeeds. Issued tokens are valid.
- **SUSPENDED:** Account flagged by admin/abuse. Authentication should fail with enumeration-safe error. Existing tokens may remain in-flight (architecture allows; revocation is future optimization).
- **DELETED:** User requested deletion. Account in soft-delete state (before hard-delete retention period expires). Authentication fails. Existing refresh tokens are revoked.

**Error handling:** Public login endpoints return uniform "invalid login" without revealing status. Authenticated endpoints may return "account disabled" within authenticated context if useful.

---

## 17. Just-in-Time Provisioning

**Strategy:** First successful login creates user.

**Atomic flow:**

```
1. POST /auth/verify { challenge: "xyz" }
2. Server validates challenge
3. Extract email from challenge
4. Lookup user_identities for (provider='email', email)
5. If NOT found:
   ↓ Begin atomic operation
   - Generate userId (UUID)
   - Create users row (id, displayName from email prefix, status=ACTIVE, timestamps)
   - Create user_identities row (userId, provider='email', email, verified=true)
   ↓ Commit
6. If found:
   ↓ Load existing userId
7. Create refresh session
8. Issue access + refresh tokens
9. Return to client
```

**Key point:** No separate "signup" step. Login creates account if missing. Atomic transactional behavior prevents partial state.

**Exact persistence implementation:** Deferred to Authentication Persistence Design v1.

---

## 18. Email Enumeration Resistance (Mandatory)

**Public magic-link endpoint must not reveal account existence.**

**Goal:** Whether the email is registered or not, public response is indistinguishable.

**Safe response (example):**

```json
200 OK
{
  "message": "If this email has an account, a login link has been sent."
}
```

**Internal server behavior (may differ):**

- Email exists: send magic link
- Email not found: log attempt, optionally queue for future async admin review, but reply same 200
- Account suspended: treat as "not found" for public response

**Rationale:** Attacker cannot enumerate registered emails via magic-link requests.

---

## 19. Rate Limiting (Policy, Not Architecture)

**Requirement:** Authentication endpoints must be protected by rate limiting.

**Dimensions to protect:**

- Email-based (max 3 magic-link requests per email per hour; example)
- IP-based (max 10 requests per IP per minute; example)
- Global abuse (circuit breaker if spike detected)

**Exact thresholds:** Not architecture. Operational policy decision based on empirical data and abuse patterns.

**Implementation technology:** Future decision (Fastify plugin, Redis, application state, etc.).

---

## 20. Refresh Token Server Storage

**Strategy:** Do not store refresh tokens in plaintext.

**Recommended approach:**

- Client receives opaque random token (e.g., 32 hex characters)
- Server stores cryptographic hash (bcrypt, PBKDF2, or scrypt)
- On refresh request:
  1. Client sends opaque token
  2. Server computes hash, looks up session record
  3. Validates hash matches
  4. Returns new access token
  5. Rotates refresh token (invalidate old, issue new)

**Replay protection:** Session record includes version/generation number. If rotated token is replayed, generation mismatch triggers invalidation of entire session family (possible future enhancement).

**Exact hashing/indexing approach:** Deferred to Authentication Persistence Design v1.

---

## 21. Refresh Rotation & Replay Handling

**Desired behavior:**

```
Refresh A issued at T0
Client uses A at T1 → Server issues B, invalidates A
If A appears again at T2:
  → Possible theft/replay detection
  → Revoke entire session or token family
  → Force client re-authentication
```

**Simple v1 approach:**

- Each refresh generates new token
- Old token is immediately invalidated in DB
- Replay of old token fails (not found)

**Future enhancement (not v1):**

- Track token "family" (all tokens generated from one initial challenge)
- If rotated token is replayed, revoke entire family
- Signals possible compromise

---

## 22. CSRF & CORS Distinctions

### CSRF (Cross-Site Request Forgery)

**Native mobile bearer-token APIs:** CSRF is generally not the primary threat. Credentials are only attached explicitly in Authorization headers per HTTP spec. Browsers cannot inject these headers cross-origin.

**Future browser-cookie sessions:** CSRF becomes relevant. Implement SameSite cookie policies; CSRF tokens if needed.

**Current scope:** Not applicable to native mobile. Clarify if future web client is introduced.

### CORS (Cross-Origin Resource Sharing)

**Browser policy only.** Does not secure native mobile clients. Native clients ignore CORS headers.

**Current scope:** Not applicable to Expo mobile app.

**Future web client:** Configure CORS as needed per web client domains.

---

## 23. Self-Hosting Clarity

**Dice Arena remains self-hostable.**

**Caveat:** Email delivery still requires one of:

- Self-hosted SMTP (Postfix, Dovecot, etc. on same server)
- Self-hosted email relay (Mta-sts)
- External email provider (SendGrid, AWS SES, etc.)

**Therefore:** "Zero external dependency" is only true if the operator supplies self-hosted mail infrastructure. If external SES/SendGrid is used, that is an external dependency (though minimal).

**Implication:** Email delivery is abstracted behind an `EmailDeliveryPort` interface. Implementation can swap between providers without changing authentication logic.

---

## 24. Email Delivery Provider Abstraction

**Conceptual boundary (implementation deferred):**

```typescript
interface EmailDeliveryPort {
  sendMagicLink(email: string, challenge: string, link: string): Promise<void>;
}
```

Authentication application logic should never know:

- SendGrid, SES, SMTP library, etc.
- Credentials, API keys, infrastructure
- Delivery guarantees or delays

**Benefits:**

- Swap providers without changing auth code
- Supports local SMTP and cloud providers identically
- Testable with mock implementation
- Self-hosted and SaaS deployments use same auth code

---

## 25. GDPR / Privacy Architecture (Deferred Details)

**Principles:**

- Collect only email, displayName, userId, status, timestamps
- Do not collect location, device info, IP (until specific feature requires)
- Email sent to external provider (require data processing agreement if SES/SendGrid)
- User can delete account → cascade delete user + identities

**Unresolved:** Exact deletion behavior for match history. Should `matches` records be:

- Deleted entirely (lose history)?
- Anonymized (preserve match facts, remove player name)?
- Kept with privacy markers?

**Architecture requirement:** Account deletion policy must be defined before implementation. Coordination with persistence FK constraints required.

---

## 26. Audit & Security Logging

**Events to log:**

- Login challenge requested (email, timestamp)
- Challenge verified successfully (userId, timestamp)
- Challenge verification failed (count, email if safe)
- Session created (userId, sessionId, timestamp)
- Refresh token rotated (sessionId, timestamp)
- Logout/revocation (sessionId, timestamp)
- Suspicious replay detected (sessionId, timestamp)

**Never log:**

- Raw tokens or challenge secrets
- Refresh token values
- Access token values

**Optional (future):**

- IP address (if rate limiting requires)
- Device fingerprint (if device binding implemented)

---

## 27. Authentication Error Semantics

**401 Unauthorized (authentication failure):**

- Missing Authorization header
- Invalid/malformed access token
- Expired access token
- Invalid refresh token on /auth/refresh
- User account disabled (in authenticated context, safe to reveal)

**403 Forbidden (authorization failure):**

- Authenticated but action not permitted (e.g., not a match participant)
- Insufficient privilege (e.g., trying to update another user's profile)

**400 Bad Request (validation failure):**

- Malformed request body
- Missing required fields
- Invalid email format

**404 Not Found:**

- Do not use 404 to hide "account not found" in login endpoints (use 401 + enumeration-safe message)
- Use 404 for resources (match not found, etc.)

---

## 28. Fastify Authentication Context (Minimal)

**Decorates FastifyRequest:**

```typescript
request.authenticatedUser = {
  userId: string, // Internal Dice Arena UUID
  sessionId: string, // Session identifier
};
```

**Minimal by design.** No email, provider, or profile data in request context.

**Plugin pattern:**

```typescript
export async function authPlugin(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    const token = extractBearerToken(request.headers.authorization);
    if (token) {
      request.authenticatedUser = verifyAccessToken(token);
    }
  });
}

export function requireAuthenticated(request: FastifyRequest) {
  if (!request.authenticatedUser) {
    throw new UnauthorizedError('authentication_required');
  }
}
```

**Routes use explicit guards:**

```typescript
fastify.post('/matches', { onRequest: [requireAuthenticated] }, async (request, reply) => {
  const userId = request.authenticatedUser!.userId;
  // ↑ TypeScript knows it's not undefined
});
```

---

## 29. Authorization Separation (Application Ownership)

**Fastify middleware enforces:** Authenticated (401 if missing).

**Application layer enforces:** Permission (403 if denied).

**Example (future gameplay endpoint):**

```typescript
// Middleware: verify token, populate request.authenticatedUser
fastify.addHook('preHandler', verifyAccessToken)

// Route: require authentication
app.post('/matches/:id/actions',
  { onRequest: [requireAuthenticated] },
  async (request, reply) => {
    const userId = request.authenticatedUser.userId

    // Application: load match, verify authorization
    const match = await matchRepository.load(request.params.id)
    if (!match.hasParticipant(userId)) {
      throw new ForbiddenError('not_match_participant')
    }
    if (match.state.activePlayerId !== userId) {
      throw new ForbiddenError('not_active_player')
    }

    // Proceed to business logic
    const result = await submitMatchAction(...)
  }
)
```

**Key point:** Transport layer enforces "authenticated", application layer enforces "authorized".

---

## 30. Optional OAuth/OIDC Socket (Future)

**Not v1. Designed for future plugging.**

Conceptual socket:

```
POST /auth/google-login { googleIdToken }
POST /auth/apple-login { appleIdToken }
```

**Flow:**

- Mobile obtains ID token from provider (using `expo-auth-session`)
- Mobile sends token to server
- Server verifies token signature with provider's public keys
- Extract email/sub from verified token
- Look up or create user_identities entry
- Map to internal userId
- Create refresh session
- Issue access + refresh tokens

**Key:** Dice Arena always issues its own access/refresh tokens. Provider tokens are single-use exchange material, not passed to client.

**Support multiple providers:** Each provider adds one endpoint and one row in user_identities.

---

## 31. Implementation Phases (No Calendar Estimates)

**Phase 1: Persistence Design**

- Define login challenge storage/verification
- Define refresh session storage + rotation
- Define indexes/constraints
- Define cleanup/expiry strategy
- Transactional boundaries
- (No code; architecture and ER diagram)

**Phase 2: Persistence Implementation**

- Schema migrations
- Repository/DAO layer
- Seed data (if needed for tests)

**Phase 3: Magic Link Issuance**

- Challenge generation
- Email queuing/sending
- TTL validation
- Consumption tracking

**Phase 4: Token Generation & Verification**

- JWT creation (access)
- Refresh session creation
- Cryptographic signing/verification
- Expiration checks

**Phase 5: Fastify Auth Middleware**

- Plugin registration
- Request decoration
- requireAuthenticated guard
- Error handling

**Phase 6: Protect POST /matches**

- Migrate transport contract (opponentUserId)
- Derive playerAUserId from auth
- Update tests
- Remove legacy two-ID support

**Phase 7: Gameplay Authorization Helpers**

- requireMatchParticipant()
- requireActivePlayer()
- Error/status handling

**Phase 8: Account Management**

- GET /user/profile
- PATCH /user/profile
- DELETE /user
- POST /auth/logout

**Phase 9: Optional OAuth/OIDC**

- /auth/google-login
- /auth/apple-login
- Mobile `expo-auth-session` integration

---

## 32. Open Architectural Questions

Genuinely unresolved; defer to future tasks:

1. **Signing key rotation:** How and when to rotate HS256 secret?
2. **Session revocation cache:** If per-request DB lookup is deemed necessary later, cache strategy?
3. **Email normalization:** Exact policy (case, domain, plus aliases, etc.)?
4. **Refresh rotation family tracking:** Should replayed rotated tokens invalidate entire token family?
5. **Account linking conflict:** If user logs in with Google, then email, should they link automatically or prompt?
6. **Password reset (if email/password added in future):** Flow and validation?
7. **Device binding (future):** Tie refresh tokens to device fingerprint/ID?
8. **OAuth provider priority:** Google + Apple? Discord? GitHub? Geographic factors?
9. **Web client auth flow (future):** Same bearer tokens or session cookies?
10. **Rate limit technology:** Redis vs. in-memory vs. distributed cache?

---

## 33. Next Recommended Task

**Do NOT implement authentication code next.**

**Next task:** AUTHENTICATION PERSISTENCE DESIGN V1

Define:

- Exact schema for users, user_identities, login challenges, refresh sessions
- Uniqueness constraints and indexes
- Transaction boundaries for atomic operations
- Cleanup/expiry strategies
- FK relationships
- ER diagram

After Persistence Design is approved, proceed to Persistence Implementation (Phase 2), then code implementation begins.

---

## Document Version

- **Version:** 1.1
- **Date:** 2026-08-30
- **Status:** Proposed. Ready for review.
- **Not implemented.**
- **Next phase:** Authentication Persistence Design v1
