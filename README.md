# Dice Arena

Dice Arena is a cross-platform Android and iOS multiplayer dice game under active development. This repository is organized as a monorepo containing the mobile application, canonical game-domain package, and supporting infrastructure.

## Technology

**Mobile:**

- React Native
- Expo
- Expo Router
- TypeScript

**Game Domain:**

- TypeScript (deterministic, infrastructure-independent)

**Tooling:**

- npm workspaces
- Jest
- ESLint
- Prettier

## Repository Structure

```
dice-arena/
├── apps/
│   └── mobile/          # React Native mobile app (@dice-arena/mobile)
│       ├── app/         # Expo Router routes
│       ├── src/         # Mobile-specific components and features
│       ├── assets/      # App icons and images
│       └── app.json     # Expo configuration
├── packages/
│   └── game-domain/     # Canonical game rules (@dice-arena/game-domain)
│       ├── src/         # Game logic, types, and scoring
│       └── tests/       # Domain unit and integration tests
├── docs/                # Architecture and game specification
└── .github/             # CI/CD workflows
```

## Prerequisites

Install the tools required for local development:

- Node.js 22.x
- npm
- Git
- Expo tooling for Android/iOS local device or emulator workflows
- macOS + Xcode for local iOS compilation (required for native iOS builds)

## Installation

```bash
git clone <repository-url>
cd dice-arena
npm ci
```

This installs all workspace dependencies (mobile app and game-domain package).

## Development

### Mobile App

Start the mobile development server:

```bash
npm run mobile:start
```

Launch platform-specific workflows:

```bash
npm run mobile:android
npm run mobile:ios
```

The iOS workflow requires macOS and Xcode for native compilation. Alternatively, use Expo cloud build/EAS workflows for remote builds.

### Game Domain

The canonical game-domain package is in `packages/game-domain/`. To run domain tests directly:

```bash
npm test --workspace=@dice-arena/game-domain -- --runInBand
```

## Quality checks

Run from repository root to validate all workspaces:

```bash
npm run lint          # ESLint across apps and packages
npm run typecheck     # TypeScript across apps and packages
npm test              # Domain tests
npm run format:check  # Prettier format verification
```

Run mobile-specific TypeScript check:

```bash
npm run typecheck --workspace=@dice-arena/mobile
```

## Environment variables

Mobile-specific environment:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Update only with public values safe to include in the mobile application. Do not commit secrets or credentials.

## Architecture

### Mobile Application (`apps/mobile/`)

- `app/`: Expo Router entry points and screens
- `src/components/`: Reusable UI building blocks
- `src/features/`: Feature-level screens and application logic

### Game Domain (`packages/game-domain/`)

Contains the deterministic, infrastructure-independent game rules:

- Scoring system (all 15 scoring categories)
- Scorecard state management
- Turn validation
- Two-player match orchestration
- WIN/LOSS/DRAW determination

The domain is:

- Independent of React / React Native
- Independent of Expo
- Independent of networking / storage / authentication
- Fully testable with no external dependencies
- Consumed by both mobile app and future backend

## Future functionality

These features are intentionally not implemented in this bootstrap, but the repository is structured to support them cleanly later:

- authentication
- multiplayer matches (live and asynchronous)
- server-authoritative game state
- match history
- player statistics
- rankings and leaderboards
- tournaments
- push notifications
- advertising
- Apple and Google in-app purchases
- backend application (TypeScript)

## Scope restrictions

This project intentionally does not include:

- Backend implementation (future work)
- WebSockets or real-time infrastructure
- Matchmaking systems
- Database integration
- Build orchestrators or unnecessary monorepo tooling

Those concerns will be designed in later phases without polluting the core mobile app or domain logic.
