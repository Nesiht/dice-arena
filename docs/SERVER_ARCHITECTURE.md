# Dice Arena Server Architecture v1

## Purpose

Dice Arena is a two-player, five-dice competitive game whose game rules are already expressed as a deterministic domain engine. The future server is the authoritative source for online play and must wrap the existing domain logic instead of modifying it.

This document defines a server architecture for the future online game, including:

- Android and iOS clients
- asynchronous multiplayer
- realtime updates when both players are online
- authoritative dice generation
- persistent MatchState
- immutable match event history
- idempotent player actions
- optimistic concurrency and match versioning
- reconnect and resynchronization
- eventual statistics and leaderboards
- future tournaments
- horizontal scaling

The architecture intentionally avoids unnecessary infrastructure before it is required. The first backend should remain simple, explicit, and correct.

---

# 1. Architectural principles

## Domain isolation

The existing deterministic Game Domain must remain independent from:

- HTTP
- WebSockets
- database technology
- authentication provider
- timestamps
- server process state
- queue technology
- Redis
- cloud provider
- analytics
- push notification systems

The backend application layer may depend on the domain.

The domain must not depend on backend infrastructure.

Dependency direction:

transport
→ application
→ domain

persistence
→ maps to/from domain

Never:

- domain → database
- domain → HTTP
- domain → WebSocket

This rule protects the domain from accidental coupling and preserves reproducible behavior.

---

# 2. Server authority

The backend is authoritative for online matches.

Clients submit intent, not authority.

Examples:

- ROLL
- SET_DIE_HELD
- SCORE_CATEGORY
- FORFEIT

Clients must not dictate:

- dice results
- awarded score
- active player
- match winner
- match version
- event sequence number
- deadlines
- rating changes

For ROLL:

client sends intent
→ server validates
→ trusted server RNG generates dice
→ Match Engine applies authoritative DiceRoll
→ state persisted
→ response returned

This boundary maintains the correct multiplayer authority model and makes the client a UI/input layer rather than the source of truth.

---

# 3. Proposed application layers

A future server architecture can be organized into the following conceptual layers.

## Transport Layer

Future examples:

- HTTP/REST endpoints
- realtime/WebSocket transport

Responsible for:

- parsing requests
- authentication context
- schema validation
- response serialization

Must not contain game rules.

## Application Layer

Responsible for use-case orchestration.

Examples:

- CreateMatch
- GetMatch
- RollDice
- SetDieHeld
- ScoreCategory
- ForfeitMatch

Responsible for:

- loading authoritative state
- player authorization
- idempotency
- concurrency/version control
- invoking domain functions
- saving resulting state
- recording events
- publishing post-commit notifications

## Domain Layer

The existing deterministic game engine.

Responsible only for game rules.

This includes the current rules expressed in the protected domain modules and the logic that validates scorecard transitions, turn flow, and match completion.

## Persistence Layer

Responsible for loading and saving:

- MatchState
- match metadata
- event history
- processed action IDs

Maps storage representation to domain representation.

## Infrastructure Layer

Future integrations such as:

- PostgreSQL
- server RNG implementation
- realtime publisher
- push notification provider
- job queue
- telemetry

This layer is intentionally separate from the rules engine.

---

# 4. Action model

A conceptual authoritative action envelope should look like:

```json
{
  "actionId": "abc-123",
  "matchId": "match_42",
  "actorPlayerId": "player_a",
  "expectedVersion": 17,
  "type": "ROLL",
  "payload": {}
}
```

Explain each field.

## actionId

Unique identifier generated for each client state-changing action.

Used for idempotency.

Retrying the same actionId must not execute the action twice.

## matchId

Persistent server identifier for the match.

This belongs to the server/application layer rather than necessarily to the pure current MatchState domain object.

## actorPlayerId

Must be derived and validated against authenticated identity.

The backend must not trust arbitrary player identity claims.

## expectedVersion

Client's last known authoritative match version.

Used for optimistic concurrency.

## type

Examples:

- ROLL
- SET_DIE_HELD
- SCORE_CATEGORY

## payload

Contains only the minimum player intent.

Example SCORE_CATEGORY:

```json
{
  "category": "fullHouse"
}
```

Never:

```json
{
  "category": "fullHouse",
  "score": 26
}
```

The server owns the authoritative calculation and validation path.

---

# 5. Idempotency

Idempotency is required for all state-changing actions.

Example:

Client sends:

- actionId = abc
- ROLL

Server:

- validates
- generates dice
- persists resulting state
- persists action result

Network response is lost.

Client retries:

- actionId = abc
- ROLL

Server MUST NOT roll again.

It returns the already accepted result or current authoritative outcome.

Idempotency records must be persisted and not stored only in process memory.

Otherwise a restart or a different backend instance may re-execute a duplicate request.

---

# 6. Match versioning

Every authoritative MatchState persistence should carry a monotonically increasing version.

Example:

- version 17
- accepted action
- version 18

State-changing operations should conceptually require:

expectedVersion == persistedVersion

If there is a mismatch:

- reject/conflict
- client resynchronizes

Do not define exact HTTP status codes yet unless they are useful for a shared API contract.

This protects against racing concurrent actions and ensures each accepted gameplay change is based on the latest server state.

---

# 7. Atomic state transition

A successful state-changing action should conceptually commit atomically:

1. verify idempotency
2. load match
3. verify version
4. validate actor
5. invoke domain
6. update MatchState
7. increment match version
8. append MatchEvent(s)
9. persist processed action/result

These steps must behave as one transactional unit.

The system must not persist a new MatchState without the corresponding authoritative event history.

Likewise, it must not append an accepted gameplay event without updating authoritative state.

This is the core correctness boundary for online turn-based play.

---

# 8. Server-side RNG

Define RNG as an infrastructure dependency supplied to the application service.

Conceptually:

```ts
interface DiceGenerator {
  rollDie(): number;
}
```

or:

```ts
interface DiceGenerator {
  rollDiceForTurn(...args: unknown[]): DiceRoll;
}
```

The application layer uses it to construct the complete authoritative DiceRoll expected by the existing Turn Engine.

The existing Turn Engine MUST remain free of RNG.

Use a cryptographically appropriate or otherwise trustworthy server random source for production.

Tests should be able to inject deterministic RNG.

Do not select a specific implementation yet unless needed.

---

# 9. Persistence model

PostgreSQL should be recommended as the primary authoritative database.

The domain is relational enough to justify a relational store:

- users
- matches
- participants
- scorecards
- events
- actions
- tournaments
- statistics

Do not create SQL or migrations in this document.

Conceptually separate:

## Current state

Fast authoritative representation of the current match.

## Historical events

Immutable ordered game history.

The backend must not need to replay all historical events for ordinary match reads.

---

# 10. Match persistence concepts

A conceptual persisted metadata representation may include:

## MatchRecord

- id
- status
- playerAId
- playerBId
- activePlayerId
- state payload / normalized state
- version
- createdAt
- updatedAt
- turnDeadlineAt
- completedAt

Do NOT decide yet whether MatchState is stored as normalized relational columns, JSONB, or a hybrid.

That is a later persistence-design decision.

---

# 11. Event log

Persist immutable authoritative events.

Conceptual fields:

- id
- matchId
- sequenceNumber
- type
- actorPlayerId
- payload
- createdAt

Events should include concepts already defined in the game specification:

- MATCH_CREATED
- PLAYER_JOINED
- MATCH_STARTED
- TURN_STARTED
- DICE_ROLLED
- DICE_HOLD_CHANGED
- CATEGORY_SCORED
- TURN_COMPLETED
- PLAYER_FORFEITED
- MATCH_EXPIRED
- MATCH_COMPLETED

Not every application action necessarily maps to exactly one event.

Sequence number is authoritative per match.

Events are append-only.

---

# 12. Realtime model

Realtime transport is not the source of truth.

After a successful committed state transition:

database commit
→ publish match-changed notification

Clients may then:

- receive updated state in the realtime message
- or fetch current state through the API

The architecture should support either strategy.

Dropped realtime messages must be recoverable by fetching current MatchState.

Do not require WebSockets for correctness.

---

# 13. Async-first multiplayer

Normal matches must remain playable when only one participant is connected.

Server persistence is authoritative.

Closing the application must have no effect on match existence.

When the opponent acts:

- state is persisted
- optional realtime update is sent
- optional push notification can be scheduled

Push notifications are not part of transaction correctness.

---

# 14. Timeout architecture

Do not implement timeout yet.

Document the future approach.

Persist authoritative:

turnDeadlineAt

A background worker or job evaluates expired turns.

Timeout processing must use the same concurrency/version protections as player actions.

Race example:

player action and timeout worker arrive simultaneously.

Exactly one state transition may win.

The other must see stale version or terminal state and stop.

Server time is authoritative.

---

# 15. Forfeit

Future explicit forfeit should be implemented as another authoritative application action.

Conceptually:

FORFEIT_MATCH

It must:

- validate player
- transition match
- record event
- persist WIN/LOSS result
- be idempotent
- increment version

Do not implement yet.

---

# 16. Authentication boundary

The Game Domain must not know how authentication works.

The transport/application layer receives an authenticated user/player identity.

The backend verifies that the authenticated player is a participant in the match.

Do not let:

request.body.playerId

alone authorize a gameplay action.

The actor identity must be bound to authenticated context.

Do not choose Google, Apple, or email authentication implementations yet.

---

# 17. Read model

Define a client-facing MatchView/read model separate from internal persisted/domain structures.

Reasons:

- avoid leaking persistence fields
- control API compatibility
- convert domain terminology to stable serialized API schema
- support future backward compatibility with older mobile versions

Conceptually MatchView may expose:

- matchId
- version
- status
- players
- activePlayer
- current turn
- scorecards
- final result
- turn deadline

Do not implement it yet.

---

# 18. Client synchronization

Client keeps:

- matchId
- lastKnownVersion

On foreground or reconnect:

GET authoritative match state

If a realtime event version is newer:

- apply update
- or fetch update

If a client sends an action with stale expectedVersion:

- server rejects conflict
- client fetches latest state
- UI resynchronizes

Client must never overwrite server state.

---

# 19. Horizontal scaling

The architecture must not rely on in-memory ownership of a match by one application server.

Any API instance should be able to process an action by loading authoritative state from shared infrastructure.

Therefore avoid designs such as:

- match lives only in Node.js process memory

For future realtime scaling, a shared pub/sub mechanism may be introduced.

Do not select Redis yet unless justified.

---

# 20. Redis position

Redis is NOT required for initial correctness.

Potential future use cases include:

- realtime pub/sub
- presence
- matchmaking queues
- hot leaderboard cache
- rate limiting
- ephemeral locks if justified

PostgreSQL remains authoritative.

Do not make MatchState correctness depend solely on Redis.

---

# 21. Background jobs

Future background worker responsibilities may include:

- turn expiration
- push notifications
- statistics materialization
- leaderboard updates
- tournament progression

Jobs must be retry-safe and idempotent.

Business-critical authoritative transitions should reuse the same application/domain rules as interactive requests.

---

# 22. Statistics pipeline

When MATCH_COMPLETED is committed:

authoritative transaction
→ match remains source of truth
→ asynchronous statistics update may occur

Statistics and leaderboards may eventually be materialized.

A statistics failure must not undo an already valid completed match.

Derived statistics can be rebuilt from authoritative match data and events when practical.

---

# 23. Failure model

Describe behavior for:

## Client loses response

Retry the same actionId.

## Server crashes before transaction commit

No authoritative action occurred.

Retry is safe.

## Server crashes after database commit but before response

Retry actionId returns the already accepted outcome.

## Realtime publish fails after commit

Match remains correct.

Client can resync via API.

Notification can be retried separately.

## Statistics worker fails

Match remains correct.

Derived data can be repaired or rebuilt.

This transactional boundary is essential.

---

# 24. Proposed initial deployment architecture

Document a simple initial architecture rather than Kubernetes or microservices.

Conceptually:

Mobile clients
↓
Load balancer / managed ingress
↓
Stateless backend containers
↓
Managed PostgreSQL

Later optional:

- realtime/pubsub
- Redis
- worker containers
- object storage

The first backend should preferably be a modular monolith.

Do not split:

- MatchService
- TournamentService
- StatsService
- UserService

into independent deployments prematurely.

Internal modules are appropriate.

---

# 25. Scale target

Document the intended initial scale envelope:

approximately:

10,000 active users initially

architecture should be able to evolve toward:

100,000 active users

Clarify that active users are not equivalent to concurrent users.

The system should scale stateless backend instances horizontally.

Turn-based Dice Arena traffic is relatively low-bandwidth.

Database correctness and concurrency are more important than raw compute performance.

---

# 26. Suggested future server module boundaries

Without implementing them, describe possible modular-monolith modules:

- auth
- players
- matches
- game-actions
- tournaments
- statistics
- leaderboards
- notifications
- purchases

Game domain remains separate.

Do not create these directories yet.

---

# 27. Server technology selection

Do NOT lock the final backend framework in this document unless it is already explicitly decided.

The mobile client uses TypeScript, and sharing deterministic domain code with a TypeScript backend may be advantageous.

Document TypeScript/Node.js as a strong candidate.

Possible frameworks can be evaluated separately.

Do not introduce NestJS, Fastify, Express, Prisma, Drizzle, Redis, BullMQ, or other specific products in this task.

Technology selection will be handled in a separate architecture decision.

---

# 28. Repository architecture question

Document that the current repository is mobile-first.

A future TypeScript backend creates a repository-layout decision:

Option A:

- keep backend in a separate repository

Option B:

- convert to monorepo, for example:

```text
apps/
  mobile/
  server/

packages/
  game-domain/
```

Do NOT perform this restructure now.

Document advantages and disadvantages and recommend when the decision should be made.

Important:

The already-tested deterministic game-domain code should eventually have exactly one canonical implementation if both mobile and server use it.

Avoid manually copying scoring or match logic between repositories.

---

# 29. Security principles

Document:

- mobile client is untrusted
- authenticate every protected action
- authorize match participant
- server generates authoritative dice
- server calculates scores and results
- idempotency prevents retry duplication
- versioning protects concurrency
- rate limiting will be needed
- no secrets in mobile client
- audit/history through immutable events
- validate all transport input

Do not write a full security threat model yet.

---

# 30. Observability

Future backend should support structured logs and metrics.

Important concepts:

- request/action correlation
- matchId
- actionId
- error type
- latency
- DB transaction failures
- conflict rates
- duplicate action retries
- realtime delivery failures

Never log:

- credentials
- access tokens
- private secrets

Detailed observability implementation is out of scope.

---

# 31. Architecture invariants

This is the final guiding section.

1. Domain logic never depends on infrastructure.
2. Client never determines authoritative dice.
3. Client never determines authoritative score or result.
4. Every accepted state-changing action is idempotent.
5. Match transitions are atomic.
6. Match versions increase monotonically.
7. Match event sequence numbers increase monotonically.
8. PostgreSQL or the persistent store is authoritative.
9. Realtime transport is not authoritative.
10. Completed historical events are immutable.
11. Stateless backend instances do not own matches in process memory.
12. Derived statistics cannot compromise authoritative match correctness.

These invariants should guide later implementation.

---

# 32. Out of scope

Explicitly list the following as not implemented by this architecture document:

- backend framework choice
- ORM choice
- SQL schema
- migrations
- HTTP endpoint definitions
- OpenAPI
- WebSocket library
- authentication provider
- Redis
- job queue product
- cloud provider
- deployment IaC
- Dockerfiles
- statistics implementation
- leaderboard implementation
- tournament implementation

---

# 33. Final recommendation section

End with a recommended implementation sequence.

Suggested order:

1. Decide repo strategy / shared domain packaging.
2. Select server runtime and framework.
3. Define the persisted Match aggregate.
4. Define the application action contract.
5. Implement server RNG abstraction.
6. Implement persistence transaction boundary.
7. Implement idempotency.
8. Implement match version concurrency.
9. Implement first Create/Get/Roll/Hold/Score use cases.
10. Add event log.
11. Add realtime synchronization.
12. Add timeout worker.
13. Add statistics materialization.
14. Add leaderboard and tournaments later.

The key principle is that correctness infrastructure must precede scale optimization.

The deterministic game domain is the protected core. The backend should wrap it and preserve it exactly as the source of truth for match rules.

---

# Final recommendation

The current repository is a mobile-first application with a tested deterministic domain layer. The most sensible future server architecture is a minimal modular monolith built around the existing domain engine, with PostgreSQL as the authoritative state store and a server-owned RNG. The domain stays pure, the application layer owns orchestration and transaction boundaries, and the transport layer remains thin. This keeps the architecture correct before scaling and avoids re-implementing or mutating the protected game rules.
