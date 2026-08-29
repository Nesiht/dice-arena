# Dice Arena Repository Architecture Decision v1

## Purpose

This document defines the repository strategy for Dice Arena as it evolves from a mobile-first React Native/Expo application into a multi-runtime product that can support:

- React Native / Expo mobile app
- TypeScript backend
- one canonical shared deterministic game-domain implementation
- shared types where justified
- independent app build/runtime concerns
- simple local development
- CI
- future scaling without unnecessary tooling

This is an architecture decision document, not an implementation task.

It is intended to preserve the trusted deterministic game engine while enabling future backend and app work without duplicating rules.

---

# 1. Current state

The current repository is mobile-first and intentionally small.

It currently contains:

- Expo React Native mobile app
- deterministic game-domain modules under src/domain
- domain unit and integration tests
- .github/copilot-instructions.md
- docs/GAME_SPECIFICATION.md
- docs/SERVER_ARCHITECTURE.md
- root package.json and package-lock.json
- root lint, typecheck, and test tooling

The backend does not yet exist.

The repository is already structured around a mobile application and a pure domain layer that is independent of React Native, network, and storage. That is a strong foundation for a future monorepo structure.

---

# 2. Core architectural requirement

There must be exactly one canonical implementation of the Dice Arena deterministic game domain.

This includes the core rules for:

- scoring
- scorecard behavior
- turn validation
- match rules
- WIN/LOSS/DRAW logic

The mobile app and future server must eventually consume the same domain package.

Avoid duplicate domain implementations such as:

- mobile/src/domain/game.ts
- server/src/domain/game.ts

as separately maintained copies.

The server remains authoritative for execution, but the shared deterministic rules must not be duplicated.

This requirement is the primary architectural reason to prefer a repo strategy that makes cross-runtime sharing easy.

---

# 3. Evaluate repository strategies

## Option A — Separate repositories

Example structure:

- dice-arena-mobile
- dice-arena-server
- dice-arena-game-domain

### Advantages

- clear runtime boundaries
- independent deployments
- simpler mobile-only vs backend-only dependency isolation when the projects are truly independent
- less coupling in early app-only work

### Disadvantages

- versioning burden across repositories
- publishing and consuming a shared domain package adds operational complexity
- CI becomes more fragmented
- game-domain drift is easier to introduce when mobile and server each maintain local interpretations
- cross-platform change review becomes harder because the domain rules are spread across repos
- local developer setup becomes more complicated

### Additional concerns

A separate-repository strategy introduces package publishing and version choreography before the project actually needs that operational complexity.

For a deterministic game domain used by both mobile and server, separate repositories increase the chance of copy-paste logic and conflicting rule interpretations.

### Bottom line

Separate repos are viable for mature products, but they are not the best default for Dice Arena at the current stage.

---

## Option B — Monorepo

Example structure:

```text
dice-arena/
  apps/
    mobile/
    server/
  packages/
    game-domain/
  docs/
  .github/
  package.json
  package-lock.json
  tsconfig.base.json
```

### Advantages

- one canonical game-domain package
- mobile and server both use TypeScript
- atomic changes across domain, client, and server are easier to review
- simpler integration testing across the shared domain
- easier developer onboarding with one repo checkout
- lower risk of duplicated game rules
- less package publishing/version choreography early on
- simpler future scaling without unnecessary tooling

### Disadvantages

- repo is slightly larger and requires workspace conventions
- CI and scripts must be configured to understand multiple package boundaries
- developers must understand workspace dependency direction
- a mishandled monorepo structure can create unnecessary overhead if it is introduced too early

### Additional concerns

Monorepo structure creates overhead only if the project expands without need. For Dice Arena, the project is still small and the shared game-domain requirement is strong, so this overhead is acceptable and manageable.

### Bottom line

A monorepo is the better fit for a shared deterministic rules package and a future server while the project is still small and early.

---

# 4. Recommended decision

Unless repository inspection reveals a strong reason otherwise, the recommended decision is:

MONOREPO

This is the most suitable architecture for Dice Arena because the project already has a deterministic domain layer and is expected to grow to include a TypeScript backend.

Reasoning:

- one canonical game-domain package
- mobile and server both TypeScript
- atomic commits across client/server/domain are easier
- faster integration testing of the shared rules
- simpler early-stage development
- less publication/version choreography
- reduced risk of duplicated game rules

The monorepo decision should be made before significant backend code exists, while the project is still small and the rules engine remains clear and intentionally isolated.

---

# 5. Proposed repository layout

A target repository layout should look conceptually like this:

```text
dice-arena/
├── apps/
│   ├── mobile/
│   └── server/
│
├── packages/
│   └── game-domain/
│
├── docs/
├── .github/
├── package.json
├── package-lock.json
├── tsconfig.base.json
└── README.md
```

## apps/mobile

Contains:

- Expo
- React Native
- Expo Router
- mobile UI
- mobile-specific state
- mobile API client
- notifications
- ads
- in-app purchases

This app should not contain authoritative game rules duplicated from the shared domain package.

## apps/server

Future backend application.

Contains:

- transport
- application/use-case layer
- persistence adapters
- authoritative RNG
- realtime transport
- auth integration
- workers where appropriate

The server depends on game-domain.

## packages/game-domain

Contains the canonical pure deterministic domain:

- game
- scorecard
- turn
- match

This package must remain independent from:

- Expo
- React
- Node server frameworks
- PostgreSQL
- HTTP
- WebSockets
- authentication
- infrastructure RNG

This is the protected rules layer, not a convenience layer or an implementation detail.

---

# 6. Workspace technology

Several workspace technologies are possible.

## npm workspaces

Advantages:

- already aligned with the current repo
- package-lock.json already exists
- Node 22 policy already exists
- simple to adopt for a small repo with two apps and one shared package
- minimal overhead compared with introducing a new toolchain

Disadvantages:

- fewer features than heavier build orchestrators
- not ideal for very large multi-package graphs

## pnpm workspaces

Advantages:

- efficient dependency management
- strong workspace support

Disadvantages:

- requires a new package manager and lockfile conventions
- creates unnecessary change for a repo that already uses npm
- introduces a package-manager migration before there is a real need

## Yarn workspaces

Advantages:

- strong workspace support
- familiar in some monorepo setups

Disadvantages:

- adds tool choice churn
- not necessary for the current repo size and current tooling

## Recommendation

For Dice Arena v1, the recommended workspace technology is:

npm workspaces

Reasoning:

- npm is already used
- package-lock.json already exists
- the project is small and early-stage
- a single shared domain package plus two app workspaces does not justify a more complex package manager migration
- this preserves the current repo’s operational simplicity

---

# 7. Build orchestration

The repo may consider future build orchestration tools, including:

- Turborepo
- Nx
- Lage
- other package task runners

## Recommendation

Do not introduce one initially.

Why:

- the project is still small
- npm workspaces plus standard scripts are sufficient for early development
- there are not yet many packages or slow build pipelines
- tooling should not outgrow the project before the project requires it

A build orchestrator should only be introduced later if real needs appear, such as:

- many packages
- slow CI
- complex dependency graph
- repeated cross-package task execution
- remote caching requirements

Before that point, simpler scripts and workspace conventions are preferable.

---

# 8. Package boundaries

The dependency direction should be clear and explicit.

Recommended direction:

apps/mobile
→ packages/game-domain

apps/server
→ packages/game-domain

packages/game-domain
→ no app package

Never allow:

- game-domain → mobile
- game-domain → server
- mobile → server internals
- server → mobile app code

This prevents circular dependencies and keeps the deterministic rules layer clean.

---

# 9. game-domain package API

The future game-domain package should expose a deliberate public API.

Conceptual layout:

```text
packages/
  game-domain/
    src/
      game.ts
      scorecard.ts
      turn.ts
      match.ts
      index.ts
    tests/
    package.json
    tsconfig.json
```

The package should export only intended public domain APIs.

Avoid application code importing private internal files arbitrarily when a clean package boundary can be established.

This ensures that the rules package remains versionable, readable, and testable as one canonical source of game logic.

Do not implement this package yet.

---

# 10. Shared types policy

Do not create a generic catch-all shared package early.

Only extract packages when there is a real shared concern.

The game-domain package is justified immediately.

Possible future packages could include:

- api-contracts
- validation schemas

But these should be created only when needed.

Avoid a structure like:

```text
packages/shared
```

becoming an unstructured dumping ground for unrelated definitions.

The shared domain package is the first and most justified extraction.

---

# 11. API contracts

Future serialized API request/response types should not automatically reuse internal persistence entities.

The app/server contract layer is a separate concern from the pure game rules.

A future dedicated package may exist only when real backend/mobile API contracts actually exist.

Possible future package:

- packages/api-contracts

But it should not be created now.

Game-domain types and external API schemas are related but are not necessarily identical.

---

# 12. TypeScript configuration

A root shared TypeScript configuration should be recommended.

Conceptually:

```text
tsconfig.base.json
```

This can define common strict settings.

Individual packages can then extend it:

- apps/mobile/tsconfig.json
- apps/server/tsconfig.json
- packages/game-domain/tsconfig.json

This keeps strict TypeScript behavior consistent while allowing environment-specific settings for Expo or Node.

Do not implement yet.

---

# 13. Expo compatibility

The repository strategy must remain compatible with the current Expo SDK and Metro behavior.

A monorepo structure can be valid only if it works with current Expo-supported workspace patterns.

The chosen structure must be validated against:

- Expo app startup
- Metro bundling
- React Native app entry points
- Expo Router paths
- asset and config resolution

Prefer direct Expo-supported workspace patterns over custom symlink hacks or brittle custom bundler workarounds.

The migration must include actual platform validation rather than only static repo configuration.

---

# 14. Tests

The future repo should keep tests aligned to the package that owns each behavior.

Recommended structure:

- packages/game-domain/tests
- apps/mobile/tests
- apps/server/tests

The existing game-domain tests should move with the canonical game-domain package during a later migration.

This preserves the pure deterministic domain tests and keeps them independent from app runtime and server concerns.

No current tests should be lost or rewritten unnecessarily during the migration.

---

# 15. Root scripts

A simple root command surface is preferable.

Examples:

- npm run format:check
- npm run lint
- npm run typecheck
- npm test

These should eventually orchestrate checks across workspaces.

Additional workspace-level commands may also exist, for example:

```bash
npm run test --workspace=@dice-arena/game-domain
```

This keeps the repo simple without imposing a large orchestration layer prematurely.

Do not implement yet.

---

# 16. CI model

A future CI system should be capable of running:

- repository formatting checks
- game-domain tests
- mobile lint/typecheck/tests
- server lint/typecheck/tests

Initially, running all checks on every PR is acceptable.

Do not optimize CI prematurely.

A later path-based selective CI model may be introduced if package count or CI duration justifies it.

---

# 17. Versioning

A monorepo can initially use private workspace packages.

The shared game-domain package should not be published to npm just to support internal consumption unless that becomes necessary.

Example conceptual package metadata:

```json
{
  "name": "@dice-arena/game-domain",
  "private": true
}
```

Mobile and server can consume it through workspace resolution.

External package versioning can be introduced later only if the product genuinely requires it.

---

# 18. Backend runtime separation

Even in a monorepo, mobile and server are distinct runtime applications.

Monorepo does not mean:

- same process
- same deployment
- same dependencies
- same environment
- mobile depends on server internals

Each runtime should retain its own package manifest and runtime dependency set.

---

# 19. Dependency installation boundaries

Backend-only dependencies should not leak into the mobile bundle.

Examples of future server-only dependencies:

- PostgreSQL driver
- ORM
- server framework
- logging library
- worker queue framework

These belong under apps/server.

Mobile-only dependencies belong under apps/mobile.

Only genuinely shared logic and code should move into a shared package.

---

# 20. Environment configuration

Each runtime should manage its own environment contract.

Example:

- apps/mobile/.env.example
- apps/server/.env.example

Mobile `EXPO_PUBLIC_*` values remain public client configuration.

Server secrets must not appear in mobile environment files.

Do not implement environment changes yet.

---

# 21. Migration risk

When converting the current repository, key migration risks include:

- Expo entry paths
- Expo Router paths
- asset resolution
- app.json configuration
- Babel configuration
- Jest configuration
- ESLint scope
- TypeScript path mapping
- GitHub Actions
- README instructions
- package-lock and workspace resolution
- existing imports from src/domain

The migration should be incremental and validated at each stage.

---

# 22. Recommended migration sequence

The following sequence is the safest path.

1. create root workspace configuration
2. create packages/game-domain
3. move the game-domain files and tests
4. verify the game-domain tests still pass
5. create apps/mobile
6. move Expo/mobile files
7. fix imports and configuration
8. validate Expo config
9. validate Android development workflow
10. validate all root checks
11. update CI
12. update README
13. commit migration
14. only then create apps/server

The key requirement is that backend implementation does not begin until the existing mobile/domain migration is stable.

---

# 23. Git history

Preserving perfect per-file Git history is less important than correctness, but normal git movement should be used where practical.

A repository migration should ideally be one focused commit or a small number of clearly scoped commits.

It should not be mixed with unrelated product feature work.

---

# 24. Naming

Recommended workspace names:

- @dice-arena/game-domain
- @dice-arena/mobile
- @dice-arena/server

Exact naming can be adjusted before implementation.

Avoid ambiguous package names that make the repo harder to reason about.

---

# 25. Tooling restraint

The repository strategy should explicitly avoid unnecessary tooling.

Do not add:

- Turborepo
- Nx
- pnpm
- Yarn
- Changesets
- Lerna

unless there is a demonstrated need.

The goal of this migration is repository structure and shared-domain discipline, not tool sprawl.

---

# 26. Recommendation

## Architecture Decision Record conclusion

Recommended decision:

- adopt monorepo
- use npm workspaces
- keep package-lock.json
- keep Node 22 policy
- do not add a build orchestrator initially
- create one canonical private game-domain package
- maintain strict dependency direction
- separate mobile and server runtime dependencies
- perform the migration before backend implementation

### Alternatives rejected

- separate repositories: rejected because it introduces package/version churn before the project actually needs it and increases the chance of rule drift
- heavy tooling: rejected because the repo is still small and the current toolchain is already adequate

This is the simplest architecture that still preserves correctness and supports future backend growth without duplicating the game domain.

---

# 27. Migration acceptance criteria

The later migration is only acceptable when all of the following are true:

- all existing 200 tests still pass
- formatting passes
- lint passes
- typecheck passes
- Expo config is valid
- mobile app starts
- Android development workflow works
- game-domain can be imported as a workspace package
- no duplicated game-domain implementation exists
- CI passes
- working tree clean
- no backend functionality has been added during migration

These acceptance criteria keep the migration disciplined and ensure that structural changes do not accidentally become feature development.

---

# Final recommendation

Dice Arena should evolve as a monorepo centered on one canonical @dice-arena/game-domain package, with Expo mobile and a future TypeScript server as separate runtime applications. The current repo already has the foundation for this direction: a deterministic game-domain layer, strict TypeScript, and rooted repo tooling. The migration should happen before backend implementation, with npm workspaces and simple root scripts as the initial operating model, while keeping the architecture minimal and avoiding unnecessary build tooling.
