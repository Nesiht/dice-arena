# Dice Arena Persistence Architecture v1

## Purpose

This document designs the future authoritative PostgreSQL persistence model for Dice Arena online multiplayer. It is an architecture decision, not an implementation plan for a database library, migration, or API.

The deterministic game domain in `@dice-arena/game-domain` is a protected core. It stays independent of PostgreSQL, HTTP, authentication, clocks, RNG, and all server infrastructure. The server application layer maps between the domain aggregate and durable storage.

## Persistence Principles

### PostgreSQL Is Authoritative

PostgreSQL is the source of truth for online match state. Application-process memory, client state, realtime transport, caches, and any future Redis deployment are non-authoritative. A process restart, reconnect, or missed realtime message must be recoverable from PostgreSQL alone.

### Current State Plus Event History

Each match persists both a current authoritative snapshot for efficient ordinary reads and an immutable ordered event history for audit, debugging, support, and reconstruction. Ordinary reads load the current snapshot and do not replay all events. This is not full event sourcing: the snapshot is the current aggregate root, and events are an authoritative history recorded alongside it.

### Transactional Correctness

One accepted state-changing action commits atomically:

1. the updated current match snapshot;
2. exactly one incremented match version;
3. its authoritative event or events; and
4. its processed idempotency action and retry result.

If any write fails, the transaction rolls back. No client acknowledgment or realtime publication occurs before commit.

## Boundaries and Terms

The following types are related but intentionally distinct:

- **Domain `MatchState`**: the pure game aggregate containing player IDs, scorecards, active player, current turn, and final result when completed.
- **Persisted match snapshot**: a schema-versioned JSONB representation of a valid domain `MatchState`, plus relational match metadata.
- **API `MatchView`**: a future client-facing representation. It must not expose persistence records directly.

The flow is:

```text
Persisted record -> persistence mapper -> Domain MatchState -> use case
  -> updated Domain MatchState -> persistence mapper -> persisted record
  -> API mapper -> MatchView
```

The persistence mapper must serialize stable JSON-compatible data only, validate a persisted snapshot before it reaches the domain, and reject unsupported schema versions. It must never persist runtime class instances.

## Core Entities

### User

`users` is an application/persistence entity, not a domain entity. A minimal user record has:

- `id`: stable server-generated identifier;
- `displayName`: current presentation name;
- `status`: product lifecycle or moderation status;
- `createdAt` and `updatedAt`: database/server-generated UTC timestamps.

No password or provider credential belongs in this table yet. A future authentication-provider identity table can relate one or more external identities to a user. Keeping it separate avoids tying gameplay identity, account lifecycle, and provider-specific authentication data together.

### Match Identity

`matches.id` is a stable server-generated UUID suitable for external references. It belongs to the server aggregate and persistence layer; the pure `MatchState` need not carry it. This lets the same deterministic domain state be used in tests or future modes without acquiring database identity.

### Match Lifecycle Status

Persistence lifecycle is broader than the existing gameplay-domain union of `ACTIVE` and `COMPLETED`:

- `CREATED`: record exists before invitation or participant completion; no playable domain state is required.
- `WAITING`: one seat is open; no playable two-player domain state is required.
- `ACTIVE`: both seats are occupied and `state` contains a valid active domain `MatchState`.
- `COMPLETED`: `state` contains a valid completed domain `MatchState` and final participant data is present.
- `FORFEITED`: terminal application state; preserve the last valid gameplay snapshot and record a forfeit event.
- `EXPIRED`: terminal application state; preserve the last valid gameplay snapshot and record an expiration event.
- `CANCELLED`: terminal pre-play or administrative state; a gameplay snapshot may be absent.

The lifecycle column drives application concerns such as matchmaking, expiration, and history. The domain status remains the source of pure gameplay semantics. They must not be forced into one shared enum.

### MatchParticipant

`match_participants` represents membership and stable seating:

- `matchId` and `userId`;
- `seat`: `A` or `B`;
- `joinedAt`;
- nullable `result`: `WIN`, `LOSS`, or `DRAW` after completion;
- nullable `finalScore` after completion.

Use a stable seat rather than insertion order. Require unique `(matchId, seat)` and unique `(matchId, userId)` so one user cannot occupy both seats. `finalScore` and `result` should be denormalized after terminal completion because they make history and future statistics queries inexpensive. The canonical detailed scorecard remains inside the immutable final match snapshot.

### Match

`matches` is the current authoritative aggregate root. Its conceptual fields are:

- `id` UUID primary key;
- `status` lifecycle status;
- `version` BIGINT;
- `stateSchemaVersion` integer;
- `state` JSONB nullable only for pre-play/cancelled states;
- `activePlayerId` nullable relational metadata;
- `turnDeadlineAt` nullable UTC timestamp;
- `createdAt`, `updatedAt`, and `completedAt` UTC timestamps.

Participants belong in `match_participants`, not duplicate `playerAId` and `playerBId` columns. Participant rows are the normalized source for seat membership. `activePlayerId` is a deliberate denormalization: it supports timeout scans, opponent notification lookups, and operations inspection without JSONB traversal. While `ACTIVE`, it must equal `state.activePlayerId`; the same transaction and mapper update both values.

## MatchState Representation

Three options exist:

1. **Fully normalized state** would use separate scorecard, turn, held-die, and roll tables or columns. It offers field-level querying but makes each domain evolution a relational migration and scatters one gameplay aggregate across tables.
2. **JSONB-only state** preserves the aggregate simply but makes lifecycle, locking, deadlines, and participant queries expensive or fragile.
3. **Hybrid state** stores query-critical relational metadata with a canonical versioned JSONB domain snapshot.

Recommend the hybrid model. The JSONB snapshot accurately captures the current deterministic `MatchState`, including scorecards, current dice, held positions, roll count, and final result. Relational columns provide identity, lifecycle, versioning, active player, deadlines, timestamps, and participant relationships. This supports fast reads, simple aggregate load/save, and future domain-state evolution without normalizing every internal gameplay field.

Risks are explicit: JSONB schemas require validation and compatibility management; arbitrary state fields are not efficiently queryable; and duplicated metadata can diverge if writes bypass the mapper. These risks are controlled through a schema version, validated mapper, transaction-only mutation path, and invariant tests.

### State Schema Version

`stateSchemaVersion` describes the serialized JSONB structure. It is distinct from `matches.version`:

- **Match version** starts at `0` at match creation and increases by exactly one for every accepted state-changing action. It provides optimistic concurrency.
- **State schema version** changes only when persisted JSON structure changes across application releases. It provides persisted-data compatibility.

For v1, use eager, deploy-time migration for active supported state versions when a breaking state shape is introduced. A deployment must not silently become unable to deserialize active matches. Temporary support for one previous schema version is acceptable only when an eager migration cannot be safely deployed.

## Actions and Idempotency

### MatchAction

`match_actions` records authenticated, processed client actions. Conceptual fields:

- `id` UUID internal key;
- `matchId` foreign key;
- `actionId` client-generated idempotency key;
- `actorUserId` foreign key;
- `expectedVersion` BIGINT;
- `actionType`;
- `requestPayload` JSONB containing minimal intent;
- `resultVersion` BIGINT nullable for rejected actions;
- `responsePayload` JSONB nullable;
- `createdAt` UTC timestamp.

Use unique `(matchId, actionId)`, rather than globally unique `actionId`. It scopes keys to the aggregate, makes lookup natural, and avoids relying on global client ID generation across unrelated matches. The retry must also verify that the stored actor and request semantics match the attempted action; a key reused with conflicting intent is rejected rather than replayed.

For accepted actions, persist a pragmatic response payload containing the resulting match version, the authoritative event sequence range, and the API response needed for retry. Include a resulting state view when the action response normally returns one. This prioritizes correct deterministic retries over premature JSONB-size optimization.

### Failed Actions

Persist accepted actions and authenticated domain-level rejections that need stable retry semantics. A rejected action stores its error outcome without advancing match version or appending a gameplay event. Do not persist unauthenticated, malformed, or rate-limited requests in `match_actions`; those are transport/security concerns and would create noisy storage and potential information leakage. Product audit requirements may later justify a separate security log.

### Server-Generated Rolls

For `ROLL` at expected version `12` with action ID `X`:

1. Begin a transaction and look up `(matchId, X)`.
2. If an accepted action exists, return its stored result without invoking RNG.
3. Load and lock the match; confirm version `12`, active lifecycle, and actor authorization.
4. Generate dice from trusted server RNG and apply the domain transition.
5. Update the snapshot and relational metadata to version `13` with a version guard.
6. Append `DICE_ROLLED` with the authoritative roll number and dice.
7. Insert action `X` with its retry result.
8. Commit, then acknowledge and optionally publish.

The action uniqueness constraint and one transaction guarantee that a lost response retried with `X` cannot generate a second authoritative roll.

## Immutable Match Events

`match_events` is append-only authoritative history. Conceptual fields:

- `id` BIGINT internal sequence primary key;
- `matchId` foreign key;
- `sequenceNumber` BIGINT per-match order;
- `type`;
- nullable `actorUserId`;
- `payload` JSONB;
- `createdAt` UTC timestamp.

Require unique `(matchId, sequenceNumber)`. Normal application behavior never updates or deletes event rows. Event payloads are versionable and contain authoritative facts, not untrusted requests. For example, `DICE_ROLLED` contains authoritative `rollNumber` and `dice`; `CATEGORY_SCORED` contains authoritative `category` and `score`.

Useful initial event concepts are `MATCH_CREATED`, `PLAYER_JOINED`, `MATCH_STARTED`, `TURN_STARTED`, `DICE_ROLLED`, `DICE_HOLD_CHANGED`, `CATEGORY_SCORED`, `TURN_COMPLETED`, `PLAYER_FORFEITED`, `MATCH_EXPIRED`, and `MATCH_COMPLETED`. This list is intentionally not exhaustive.

Event sequence is not match version. They commonly increase together, but one action can create several events, such as `CATEGORY_SCORED`, `TURN_COMPLETED`, and `TURN_STARTED`, while the match version increases once. Event sequence is for causally ordered history; version is for snapshot concurrency.

## Transactions and Concurrency

Use PostgreSQL `READ COMMITTED` with a transaction-scoped row lock for mutation and an explicit version guard. This is a pragmatic v1 choice: stricter `SERIALIZABLE` isolation adds abort/retry complexity that is not needed for low-frequency, turn-based writes when version guards are correctly enforced.

Within one transaction, lock the match row with `SELECT ... FOR UPDATE`, validate authorization and expected version, execute the domain operation, and issue an update conditioned on the expected version. Exactly one row must be updated. Zero updated rows is a concurrency conflict requiring reload/resynchronization.

The row lock serializes in-flight mutations for the same match; the version guard protects stale clients and guards against accidental paths that do not share the same lock. Do not rely on application-memory or distributed locks for correctness.

### Transaction Scope Invariant

A transaction-scoped database executor must never escape its transaction callback or be stored for later use. Production persistence code keeps every transaction-dependent operation inside `withTransaction(async (tx) => { ... })`. It must not rely on the database driver to reject a handle used after commit or rollback.

For a race between a player action at version `12` and a timeout worker at version `12`, only one transition can commit version `13`. The other reloads and either observes a terminal/new state or reports a conflict. Realtime notification is published only after the transaction commits, because publishing first could expose a state that rolls back.

## Constraints and Indexes

Conceptual constraints:

- `matches.version >= 0` and starts at `0`.
- Terminal completed/forfeited/expired matches have `completedAt` where product semantics require it.
- Active matches have valid JSONB state, an active player, and participant seats `A` and `B`.
- `match_participants`: unique `(matchId, seat)` and unique `(matchId, userId)`.
- `match_actions`: unique `(matchId, actionId)`.
- `match_events`: unique `(matchId, sequenceNumber)`.
- Foreign keys preserve participant, action, and event referential integrity. Do not cascade-delete match history during ordinary user or match operations.

High-value initial indexes:

- `matches(status, turnDeadlineAt)` for due active-turn scans;
- `matches(activePlayerId, status)` for operational/player-active lookup;
- `matches(createdAt)` for operational ordering;
- `match_participants(userId, matchId)` for player match history;
- unique `match_actions(matchId, actionId)` for idempotency;
- unique `match_events(matchId, sequenceNumber)` for ordered history reads;
- completed-match participant/result indexes only when statistics reads prove the need.

Avoid speculative indexes on arbitrary JSONB paths. Add them only when measured query patterns require them.

## Read and Lifecycle Behavior

The model supports get-match-by-ID, active/recent match lists for a user through `match_participants` joined to `matches`, mutation aggregate loads, idempotency lookup, ordered event history, deadline scans, and future completed-match statistics processing. Do not create a redundant `match_history` table: history derives from participants plus matches.

`turnDeadlineAt` is a relational indexed column, never hidden only in JSONB, because a future worker must efficiently find active matches whose deadline is due. Server/database timestamps use timezone-aware UTC values; client timestamps never decide authoritative transitions.

On completion, update lifecycle status to terminal, populate `completedAt`, write final participant results and scores, retain the final snapshot, and append `MATCH_COMPLETED` in the same transaction. Later gameplay actions are rejected. Completed matches are not physically deleted in ordinary operation. Retention, account deletion, anonymization, and legal hard deletion are separate future policy decisions.

## Derived Systems

Statistics, leaderboards, and tournaments are derived or contextual systems, never part of match correctness.

After `MATCH_COMPLETED`, a future worker/materializer may derive wins, losses, draws, highest/lowest score, and streaks. A failure there cannot change authoritative match data. Leaderboards are future derived read models and must not store ranking position in `matches`.

Future tournament matches may reference `tournamentId` and `roundId` as optional contextual metadata without changing reusable core Match semantics. No tournament, statistics, or leaderboard tables are introduced by this design.

## Scalability, Recovery, and Security

This model is appropriate for approximately 10,000 active users initially and growth toward 100,000: Dice Arena is turn-based, writes per match are low-frequency, snapshots are small, deadline and participant queries are indexed, and backend instances remain stateless over shared PostgreSQL. Do not introduce sharding, distributed databases, or Redis for correctness at this stage.

Future operations require automated backups, point-in-time recovery, migration rollback planning, and restore testing. PostgreSQL is authoritative, so recovery procedures are product-critical.

Persistence must not store access tokens in gameplay tables, must minimize PII in event payloads, must use user IDs instead of copied profiles, must validate serialized payloads, and must use least-privilege database credentials. This remains ORM-neutral: a later choice among Prisma, Drizzle, direct SQL, or a query builder must satisfy this design rather than reshape it.

## Persistence Invariants

1. PostgreSQL is authoritative.
2. One Match row owns the current authoritative snapshot.
3. Match version increases monotonically.
4. Accepted state changes are atomic.
5. An accepted action ID is never executed twice.
6. Server RNG output is persisted before action acknowledgment.
7. MatchEvents are immutable.
8. Event sequence increases monotonically per match.
9. Client state never overwrites server state.
10. Realtime is never authoritative.
11. Completed matches reject gameplay mutation.
12. Derived statistics never participate in match correctness.
13. Relational metadata and JSONB state cannot diverge after commit.
14. Persisted state is schema-versioned.

## Open Decisions

The following are intentionally deferred: ORM/query layer, exact SQL types and UUID generation mechanism, authentication schema, exact event payload schemas, JSON serialization/validation implementation, statistics schema, tournament schema, retention policy, backup provider, and production hosting.

## Recommended Implementation Sequence

1. Choose PostgreSQL access technology against this design.
2. Add database configuration in the server workspace.
3. Create migrations for the five core entities.
4. Implement and test the persisted-state validator and mapper.
5. Implement a transaction/unit-of-work boundary.
6. Implement match aggregate load/save.
7. Add MatchAction idempotency storage and MatchEvent append logic.
8. Add optimistic concurrency and transaction tests.
9. Build `CreateMatch`, then `GetMatch`.
10. Add authoritative `ROLL`, followed by hold and score actions.
11. Add post-commit realtime and a timeout worker only when those features are needed.

Correctness precedes optimization throughout this sequence.
