# Dice Arena — Repository Engineering Instructions

## Project purpose

Dice Arena is a cross-platform competitive five-dice mobile game for Android and iOS.

The mobile client is built with:

- React Native
- Expo
- Expo Router
- TypeScript
  The project is intended to become a production application with future support for:

- player accounts
- multiplayer matches
- asynchronous matches
- live matches
- match history
- statistics
- rankings
- leaderboards
- tournaments
- push notifications
- advertising
- in-app purchases
  The current repository is intentionally small.

Do not add speculative architecture or infrastructure before a real feature requires it.

---

## General engineering principles

Always prefer:

- simple explicit code
- strong TypeScript types
- small focused modules
- pure functions where practical
- clear dependency boundaries
- testable business logic
- platform-independent shared code
  Avoid:

- premature abstraction
- unnecessary dependency installation
- oversized components
- hidden side effects
- duplicate business logic
- unnecessary global state
- speculative service layers
- speculative generic frameworks
  Do not create empty folders solely because they might be useful later.

---

## TypeScript

TypeScript strict mode must remain enabled.

Rules:

- Do not use `any` unless there is a documented technical reason.
- Prefer explicit domain types over unstructured objects.
- Prefer discriminated unions where they improve domain modelling.
- Prefer `readonly` for values that should not be mutated.
- Use type-only imports where applicable.
- Do not weaken compiler configuration to make code compile.
- Do not suppress TypeScript errors without understanding and documenting the reason.

---

## Application architecture

Use the repository structure intentionally.

### `app/`

Contains Expo Router routes and route-level composition.

Route files should remain thin.

Do not place game rules or substantial business logic inside route files.

### `src/components/`

Contains reusable presentation components.

Components in this directory should not contain game rules or backend-specific logic.

### `src/features/`

Contains feature-specific UI composition and application behavior.

Features may coordinate domain functions, UI, hooks, and future services.

Features should not duplicate domain rules.

### `src/domain/`

Contains pure application and game-domain concepts.

Domain code must:

- remain independent of React
- remain independent of Expo
- remain independent of navigation
- remain independent of network APIs
- remain independent of storage implementations
- remain highly testable
  Game rules belong here or in a future shared domain package.

Do not import React Native modules into domain code.

### Dependency direction

The architecture should generally flow:

app
→ features
→ domain

Feature code may use reusable UI components.

Domain code must never depend on:

- app routes
- feature modules
- React components
- React hooks
- navigation
- network clients
- storage implementations
  Higher-level layers may depend on lower-level layers, but lower-level domain code must not depend on higher-level application or presentation layers.

Avoid circular dependencies between modules.

---

## Multiplayer authority model

This is a critical architectural rule.

For online multiplayer, the server will be authoritative.

The mobile client must never be trusted to determine authoritative:

- dice results
- final scores
- valid moves
- match results
- rankings
- tournament advancement
- purchases
- rewards
  The future backend will own authoritative game state.

The client may:

- display game state
- collect player input
- render animations
- show optimistic UI where safe
- validate locally for user experience
  But server responses remain the source of truth for online matches.

Never design multiplayer logic where the client sends a self-generated dice result or final match outcome that the server simply accepts.

---

## Game randomness

Random dice generation currently exists in the mobile domain foundation for bootstrap/testing purposes.

Do not assume client-side random generation will be authoritative for online multiplayer.

When implementing online matches in the future:

- dice generation must occur on the authoritative server
- the client receives dice results from the backend
- domain scoring logic should remain deterministic
  Local/offline game modes may use client-side randomness if explicitly required.

---

## Game domain design

Game rules should be modelled as deterministic domain logic.

Core game-rule functions should be deterministic whenever practical.

Pure domain functions such as scoring, move validation, category availability, and state transitions must not directly read from:

- system clock
- network
- persistent storage
- React state
- device APIs
- random number generators
  Instead, external values should be supplied explicitly as function inputs when needed.

Randomness is an external concern.

For online multiplayer, authoritative randomness belongs on the server.

This is intended to make game logic reproducible, testable, replayable, and independently verifiable.

Prefer structures such as:

game state +
player action
→
validated state transition

Examples of future domain concepts may include:

- MatchState
- TurnState
- ScoreCard
- ScoreCategory
- PlayerAction
- MatchStatus
  Do not introduce these until the relevant feature is being implemented.

Do not create a large speculative game engine before requirements are defined.

---

## State management

Do not add Redux, Zustand, MobX, or another global state library automatically.

Use the simplest state mechanism appropriate for the feature.

Prefer:

1. local component state
2. feature-level hooks
3. React Context when justified
4. external state libraries only when clear application complexity requires them
   Before introducing a state library, explain why React-native/local state is insufficient.

---

## Networking

No networking library is currently required.

When API communication is introduced:

- keep network transport separate from domain rules
- do not call APIs directly from reusable UI components
- use typed request/response boundaries
- handle errors explicitly
- handle cancellation/timeouts where appropriate
- never embed secrets in the client
  Do not install Axios automatically if the platform `fetch` API is sufficient.

---

## Security

Never commit:

- secrets
- API keys intended to remain private
- credentials
- signing certificates
- private keys
- service account files
  Use environment configuration appropriately.

Remember:

Variables prefixed with `EXPO_PUBLIC_` are available to client-side application code and must never contain secrets.

The mobile application must be considered an untrusted client.

Never rely on client-side checks alone for:

- authentication authorization
- match integrity
- purchases
- leaderboard updates
- tournament results
- reward allocation

---

## In-app purchases

Future Apple App Store and Google Play purchases must be verified through trusted backend logic before granting permanent server-side entitlements.

Never treat a client message such as:

"I purchased this item"

as sufficient proof of purchase.

Do not implement purchase infrastructure unless explicitly requested.

---

## Testing

New domain logic must have unit tests.

Tests should focus on behavior, not implementation details.

Prioritize tests for:

- game rules
- scoring
- state transitions
- invalid actions
- boundary conditions
- regression bugs
  UI tests should be added for meaningful screen behavior and interactions.

Avoid excessive snapshot testing.

Do not make tests pass by weakening production code correctness.

---

## Code quality gates

Before completing code changes, run the relevant repository checks.

For normal TypeScript/application changes, run:

npm run format:check
npm run lint
npm run typecheck
npm test -- --runInBand

Fix errors introduced by the change.

Do not silently ignore failing checks.

If a check cannot be run, report that clearly.

---

## Dependencies

Do not add dependencies without a clear reason.

Before adding a library:

- verify that existing platform capabilities are insufficient
- prefer well-maintained libraries
- confirm compatibility with the current Expo SDK
- avoid overlapping libraries solving the same problem
- explain why the dependency is needed
  Do not upgrade unrelated dependencies as part of feature work.

---

## Expo and React Native

Maintain compatibility with the configured Expo SDK.

Prefer Expo-supported APIs where appropriate.

Avoid ejecting or introducing custom native code unless the feature genuinely requires it.

Keep Android/iOS-specific implementation isolated.

Shared behavior should remain platform-independent wherever possible.

---

## Navigation

Expo Router is the navigation framework.

Route files should remain primarily responsible for:

- route composition
- route parameters
- navigation integration
  Do not place substantial business logic inside route files.

---

## Environment policy

`.env.example` documents supported environment variables.

Local `.env` files must not be committed.

Do not place private credentials in `EXPO_PUBLIC_*` variables.

Client environment configuration should contain only values safe to distribute inside the mobile application.

---

## Git and scope discipline

Keep changes focused on the requested task.

Do not refactor unrelated code.

Do not introduce speculative functionality.

Do not implement future features unless explicitly requested.

Do not silently change architecture decisions.

If a requested feature requires a significant architectural decision, explain the decision before introducing unnecessary complexity.

---

## Current architecture status

The repository is intentionally early-stage.

Currently implemented:

- Expo Router application shell
- initial home screen
- reusable UI button
- minimal dice domain types
- dice validation/generation utilities
- unit tests
- ESLint
- Prettier
- TypeScript strict mode
- GitHub Actions CI
  Not yet implemented:

- backend
- authentication
- multiplayer
- API services
- persistent state
- database
- match engine
- full scoring rules
- matchmaking
- leaderboards
- tournaments
- advertisements
- in-app purchases
  Do not assume these systems exist.

---

## Decision priority

When requirements conflict, prioritize in this order:

1. correctness
2. security and game integrity
3. maintainability
4. simplicity
5. testability
6. performance
7. convenience
   Do not optimize prematurely.

For a turn-based dice game, clear and correct code is more important than low-level optimization.
