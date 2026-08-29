# ADR: Database Access Technology v1

## Status

Accepted for the next persistence implementation task. This ADR selects a database access stack only; it does not install dependencies, define a schema in code, create migrations, or implement persistence.

## Context

Dice Arena is a Node 22, TypeScript, Fastify npm-workspaces application. `@dice-arena/game-domain` is a protected deterministic package and must never depend on a database library, database row type, or generated client.

The authoritative PostgreSQL design is defined by [PERSISTENCE_ARCHITECTURE.md](PERSISTENCE_ARCHITECTURE.md). It requires relational metadata and a versioned JSONB `MatchState` snapshot, immutable ordered events, idempotent actions, and transactions that correctly serialize competing match mutations. Database portability is not a goal.

The decisive use case is a gameplay action:

```text
BEGIN
lookup MatchAction by (matchId, actionId)
SELECT match FOR UPDATE
verify expectedVersion
load and validate JSONB MatchState
invoke deterministic domain operation
UPDATE matches with WHERE id = matchId AND version = expectedVersion
verify exactly one row changed
INSERT one or more MatchEvents
INSERT MatchAction result
COMMIT
```

For a server-generated `ROLL`, retrying an accepted action ID must return the persisted result without generating dice or invoking domain logic again. The access technology must make that transaction obvious, parameterized, and testable against real PostgreSQL.

## Decision Criteria

The selected approach must support PostgreSQL, Node 22, strict TypeScript, Fastify, npm workspaces, JSONB, UUID, BIGINT, TIMESTAMPTZ, constrained status representation, composite keys and unique constraints, foreign keys, checks, indexes including partial indexes, transactions, row locks, guarded updates, row-count verification, ordered batch event insertion, pooling, migrations, handwritten migration escape hatches, and real-PostgreSQL integration tests.

Compile-time query typing is useful, but it does not validate a JSONB value loaded from PostgreSQL. The persistence mapper must still validate and upgrade serialized `MatchState` at runtime before it reaches the domain.

SQL control and transaction/concurrency fit receive the highest weighting because a tool that makes CRUD pleasant but makes `FOR UPDATE` or guarded version updates awkward is not a good fit.

## Candidates Evaluated

### Drizzle ORM

Drizzle provides a TypeScript schema model for PostgreSQL, typed query construction, and `drizzle-kit` migration tooling. Its PostgreSQL schema API represents UUID, BIGINT, JSONB, timestamps with timezone, enums or text/check representation, composite unique constraints, foreign keys, checks, and indexes. The official indexes and constraints guide documents composite uniqueness, checks, and partial index predicates. Its PostgreSQL transaction API accepts explicit isolation configuration including `read committed`.

Drizzle is deliberately SQL-shaped. Its `sql` template parameterizes values while allowing table and column interpolation, arbitrary PostgreSQL expressions, `RETURNING`, and raw execution inside the same transaction. PostgreSQL row locking can remain an explicit lock clause or parameterized SQL rather than hidden behind ORM lifecycle behavior. A guarded update can use typed predicates and `returning`, then treat an empty returned set as a concurrency conflict.

Drizzle supports both `pg` and `postgres.js`. Do not select either driver on convenience alone. Recent reports against stable `drizzle-orm` 0.45.2 identify node-postgres adapter risks relevant to this system: a pooled client can leak when `BEGIN` rejects, and a transaction handle can remain usable after commit or rollback. Those reports do not prove Drizzle is unusable, but they are material where correctness relies on pool recovery, idempotency, and row locks. They require a real-PostgreSQL transaction spike before selecting this adapter.

Drizzle itself has no generated runtime client; `drizzle-kit` is a development dependency and can generate reviewable SQL migrations. Recent PostgreSQL introspection reports also show generate/pull asymmetry around checks, defaults, partitioned parents, and index opclasses. Therefore, generated migration SQL must be reviewed, committed, and tested in CI against a real PostgreSQL database. Do not use `drizzle-kit push` as the production migration mechanism.

Strengths are transparent PostgreSQL semantics, a small runtime model, schema/query inference, and an uncomplicated SQL escape hatch. Risks are current 0.x stable maturity, a still-pre-release 1.0 line, the node-postgres transaction reports, migration/introspection reports, and the fact that JSONB runtime validation remains manual. Use a pinned stable release unless a specifically reviewed critical fix exists only in an RC; review relevant open issues before production deployment.

### Prisma

Prisma must be evaluated as two current release lines. Prisma 8 is the current release line, with richer current transaction and SQL-builder facilities, but its current PostgreSQL setup requires Node.js 24 or newer. That conflicts with Dice Arena's approved Node 22 policy. Prisma 7 remains supported and is compatible with Node 22, but has a different generated-client/runtime model. Dice Arena must not migrate to Node 24 solely to adopt Prisma 8; that would require a separate runtime decision.

Across its supported lines, Prisma provides a declarative data model, generated client/types, PostgreSQL support, migrations, JSONB, UUID, BIGINT, TIMESTAMPTZ, compound constraints, and transactions. Current official documentation covers parameterized `$queryRaw`/`$executeRaw`, TypedSQL generation, and running raw SQL within transactions. `$executeRaw` provides affected-row counts, and current schema documentation covers PostgreSQL index methods plus partial-index support through a preview feature.

Prisma can implement the benchmark, but it is less natural for it. `SELECT ... FOR UPDATE`, `UPDATE ... RETURNING`, exact locking clauses, and some migration DDL become raw SQL or TypedSQL. Raw result typing is generic unless generated TypedSQL is used, and TypedSQL adds SQL files, generation, and an active database connection during generation. Prisma raw APIs remain parameterizable, but identifiers and SQL keywords cannot be interpolated as values. The official migration guidance also requires generated/compiled migration artifacts and has its own workflow.

That does not make Prisma unsafe or incapable. Prisma 8 materially improves the technology family's transaction and typed SQL story; it is not rejected for obsolete limitations. It is a strong choice for teams that can standardize on Node 24 and benefit from its generated client. For Dice Arena, the Node 24 requirement blocks the current release line, while the Node 22-compatible Prisma 7 path retains a different runtime model. Critical mutation paths would also repeatedly leave model-level CRUD, reducing the benefit of a full ORM.

### Kysely Plus PostgreSQL Driver

Kysely is a strongly typed SQL query builder, not a full ORM. It expresses transactions, `RETURNING`, and PostgreSQL-oriented SQL naturally; its query API supports row-lock clauses such as `forUpdate()`, and raw SQL remains first-class. The benchmark transaction is very transparent. Kysely's official documentation shows transaction callback rollback behavior and recommends a typed `Database` interface. It also supports JSON column types at compile time.

Kysely requires a PostgreSQL driver, typically `pg`, plus a manually maintained or separately generated `Database` interface. Its migration system provides ordered up/down migrations and supports handwritten schema/data operations, but has less schema-as-code integration and developer guardrails for this project than Drizzle. Its runtime types are provided by the driver, not Kysely, so runtime JSONB validation remains manual.

Kysely is an excellent alternative where the team explicitly wants SQL-first repositories and accepts manual schema type synchronization. For Dice Arena v1, it adds enough manual table typing, mapping, and migration convention work that the extra control over Drizzle is not worth the cost.

### Direct node-postgres (`pg`) and Handwritten SQL

Direct `pg` is the baseline for PostgreSQL control. It provides parameterized queries, `Pool`, explicit `BEGIN`/`COMMIT`/`ROLLBACK` over one checked-out client, affected row counts, and direct access to every PostgreSQL feature. Its own documentation warns that a transaction must use one client rather than `pool.query`; it also documents returning clients to the pool and draining with `pool.end()`.

This is maximally transparent and has the smallest abstraction layer, but it delegates all schema typing, result mapping, migration execution, and query repetition to the application. The resulting manual correctness surface is unjustified for ordinary Dice Arena reads and writes. Use direct driver access only as an implementation detail beneath Drizzle if a future PostgreSQL feature cannot be expressed safely through Drizzle's transaction/query APIs.

## Weighted Decision Matrix

Scores use 1 to 5, where 5 is strongest for Dice Arena's specific requirements. Weighted total is the sum of score multiplied by weight, on a 5-point scale.

| Criterion                           |   Weight |  Drizzle |   Prisma | Kysely + pg | Direct pg/SQL |
| ----------------------------------- | -------: | -------: | -------: | ----------: | ------------: |
| PostgreSQL control and explicit SQL |      20% |        5 |        4 |           5 |             5 |
| Transaction and concurrency fit     |      20% |        4 |        4 |           5 |             5 |
| Migration control                   |      15% |        3 |        4 |           3 |             2 |
| TypeScript and query type safety    |      10% |        4 |        5 |           4 |             2 |
| Developer ergonomics                |      10% |        4 |        4 |           3 |             2 |
| Domain isolation                    |      10% |        5 |        4 |           5 |             5 |
| Real PostgreSQL testing             |       5% |        3 |        4 |           4 |             3 |
| Operational simplicity              |       5% |        3 |        2 |           4 |             5 |
| Performance and flexibility         |       5% |        4 |        4 |           5 |             5 |
| **Weighted total / 5**              | **100%** | **4.15** | **3.85** |    **4.15** |      **3.75** |

Drizzle and Kysely tie numerically. Kysely keeps the critical transaction entirely explicit while using the mature `pg` client directly. Drizzle provides better integrated typed schema declarations and SQL migration generation while retaining parameterized SQL. Drizzle's current node-postgres adapter and kit risks prevent selecting a driver without a spike, but do not invalidate its technology-level fit. Prisma's current SQL capabilities improve its score, but Prisma 8's Node 24+ requirement lowers its operational fit under Dice Arena's Node 22 policy. Direct `pg` wins control but loses too much type and migration ergonomics.

## Failure-Mode Comparison

| Candidate     | Primary implementation risk                                                                                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drizzle       | Stable 0.45.2 node-postgres adapter reports cover pool recovery after rejected `BEGIN` and transaction handles usable after completion; kit pull/generate reports require strict migration review. |
| Prisma        | Prisma 8's current Node 24+ PostgreSQL requirement conflicts with Dice Arena Node 22; Prisma 7 is supported but has a different generated-client/runtime path.                                     |
| Kysely + pg   | Drift between manually maintained database TypeScript interfaces, migrations, and runtime mapper behavior.                                                                                         |
| Direct pg/SQL | Repetitive hand-written mapping and SQL create avoidable type, transaction-client, and migration mistakes.                                                                                         |

## Decision

### ADOPT: Drizzle ORM

Adopt Drizzle ORM for `apps/server`. Its typed PostgreSQL schema and reviewable SQL migration generation break the numerical tie with Kysely for this small monorepo, while its parameterized `sql` escape hatch keeps the MatchAction lookup, `SELECT ... FOR UPDATE`, version-guarded `UPDATE ... RETURNING`, event insertion, and result write explicit.

**Driver decision: defer.** Select between node-postgres and postgres.js only after a focused real-PostgreSQL transaction spike proves pooled concurrent requests, failed `BEGIN`, rollback, transaction timeout, and graceful server shutdown. The current node-postgres reports make a convenience-based choice unacceptable. A later driver decision may choose either supported adapter with pinned versions and documented acceptance results.

**Migration execution: generate migrations, review generated SQL, commit SQL migrations, and run them in CI/test PostgreSQL.** Do not use `drizzle-kit push` as the production migration mechanism. Hand-edit generated SQL where PostgreSQL evolution requires it, then review and test the resulting migration.

The first persistence spike must prove against real PostgreSQL: `FOR UPDATE`; expected-version guarded update and exact affected-row result; rollback; simultaneous mutation conflict; failed `BEGIN` and pool recovery; idempotent retry without a second RNG call; atomic multiple event insertion; transaction timeout behavior; and graceful connection-pool shutdown. Mock-only testing is insufficient. API shape alone is not proof of correctness.

### REJECT: Prisma for v1

Prisma is not the best fit because Prisma 8 currently conflicts with the approved Node 22 runtime policy, and the Node 22-compatible Prisma 7 path is not the same current runtime model. Prisma can implement the core flow through current raw SQL, TypedSQL, and transaction facilities, but it would use lower-level interfaces frequently. Reconsider Prisma after a separately approved Node 24 migration or if conventional relational CRUD becomes dominant.

### REJECT: Kysely Plus pg for v1

Kysely is not the best fit because its SQL control is excellent but it requires more hand-maintained schema typing, mapping, and migration convention than Dice Arena needs. Reconsider it if the team chooses a deliberately SQL-first architecture and is willing to own that infrastructure for explicit control.

### REJECT: Direct pg/SQL for v1

Direct `pg` is not the best fit because it shifts too much repetitive type and mapping responsibility into application code. It remains the control baseline and an acceptable narrowly scoped escape hatch under the selected stack, not the primary persistence interface.

## Architectural Usage

When implementation begins, conceptual ownership is:

```text
apps/server/src/persistence/
  db/          selected driver pool and Drizzle initialization
  schema/      Drizzle PostgreSQL table declarations
  migrations/  generated, reviewed, committed SQL migrations
  mappers/     persisted snapshot <-> validated domain MatchState
```

The Drizzle schema remains inside persistence. The application/use-case layer owns the transaction boundary and depends on the mapper. `@dice-arena/game-domain` receives and returns only domain values; it never imports Drizzle, a driver, or a database row type.

## Consequences

Positive consequences:

- PostgreSQL lock, version, `RETURNING`, JSONB, and index semantics remain visible.
- Ordinary reads and writes receive typed schema/query assistance.
- PostgreSQL transaction SQL remains directly legible and parameterized.
- No generated runtime client or database model leaks into the domain.
- `pg` supplies standard pooling suitable for stateless Fastify containers and managed PostgreSQL.

Negative consequences:

- Developers must understand PostgreSQL transaction and migration behavior.
- The mapper and JSONB runtime validation remain explicit work.
- Some advanced operations intentionally use `sql` rather than a purely fluent API.
- Stable Drizzle and the selected driver require a focused transaction spike and pinned versions.

Revisit this decision only if Drizzle loses maintenance or Node compatibility, the driver spike or migration/test workflow proves unreliable, PostgreSQL ceases to be the database architecture, or project/team scale materially changes the explicit-SQL versus generated-client tradeoff.

## First Implementation Step

After approval, run the focused Drizzle driver/transaction spike against real PostgreSQL before production dependencies are selected. The spike must compare node-postgres and postgres.js for the documented failure and shutdown behavior. Do not combine it with gameplay endpoints or persistence use cases.

## Open Questions

- Confirm the selected driver and exact pinned stable Drizzle/drizzle-kit versions after the transaction spike.
- Define local and CI real-PostgreSQL provisioning and migration deployment ownership.
- Decide whether UUID generation occurs in PostgreSQL or the server application.
- Specify the JSONB snapshot validator, state-schema migration protocol, and migration review/release process.
- Define database pool sizing, credentials, TLS, and managed PostgreSQL provider during deployment design.

## Research Record

Research was performed on 2026-08-29 using current official sources:

- Drizzle ORM docs: [PostgreSQL setup](https://orm.drizzle.team/docs/get-started-postgresql), [transactions](https://orm.drizzle.team/docs/transactions), [indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints), [SQL operator](https://orm.drizzle.team/docs/sql), and [migrations](https://orm.drizzle.team/docs/migrations). Current relevant reports: [#6023](https://github.com/drizzle-team/drizzle-orm/issues/6023), [#6083](https://github.com/drizzle-team/drizzle-orm/issues/6083), and [#6093](https://github.com/drizzle-team/drizzle-orm/issues/6093).
- Prisma docs: [transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions), [raw SQL](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries), [TypedSQL](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/typedsql), [indexes](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes), and [migration editing](https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations).
- Kysely docs: [getting started](https://kysely.dev/docs/getting-started), [transactions](https://kysely.dev/docs/examples/transactions/simple-transaction), and [migrations](https://kysely.dev/docs/migrations).
- node-postgres docs: [transactions](https://node-postgres.com/features/transactions), [pooling](https://node-postgres.com/features/pooling), and [parameterized queries](https://node-postgres.com/features/queries).

Published registry versions observed on that date: `drizzle-orm` 0.45.2, `drizzle-kit` 0.31.10, `@prisma/client` 7.10.0, `prisma` 8.0.0-rc.12, `kysely` 0.29.5, and `pg` 8.23.0. Prisma documentation identifies Prisma 8 as the current release line and Prisma 7 as supported; current Prisma 8 PostgreSQL setup requires Node 24+, while Dice Arena remains Node 22. Version choice remains deferred until implementation because this ADR must not install dependencies.
