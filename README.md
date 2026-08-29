# Dice Arena

Dice Arena is a cross-platform Android and iOS multiplayer dice game under active development. This repository contains the initial production-oriented foundation for a mobile game built with Expo, React Native, TypeScript, and Expo Router.

## Technology

- React Native
- Expo
- Expo Router
- TypeScript
- Jest
- React Native Testing Library
- ESLint
- Prettier

## Prerequisites

Install the tools required for local development:

- Node.js LTS
- npm
- Git
- Expo tooling for Android/iOS local device or emulator workflows
- macOS + Xcode for local iOS compilation

## Installation

```bash
git clone <repository-url>
cd dice-arena
npm ci
```

## Development

Start the Metro bundler and development server:

```bash
npm start
```

Launch platform-specific workflows:

```bash
npm run android
npm run ios
```

The iOS workflow usually requires macOS and Xcode. Expo-based app flows can also be used to test on compatible devices without a local native build environment.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run format:check
```

## Environment variables

Copy the example environment file and set any local values you need:

```bash
cp .env.example .env
```

Update the file with environment-specific public values only. Do not commit secrets, private credentials, or signing material.

## Architecture

This app keeps the architecture intentionally simple and extensible:

- app/: Expo Router entry points and screens
- src/components: reusable UI building blocks
- src/features: feature-level screens and orchestration logic
- src/domain: game rules, domain models, and pure logic
- src/services: API clients and external integrations
- src/store: application state and persistence boundaries

## Future functionality

These features are intentionally not implemented in this bootstrap, but the repository is structured to support them cleanly later:

- authentication
- multiplayer
- server-authoritative matches
- match history
- statistics
- rankings and leaderboards
- tournaments
- push notifications
- advertising
- Apple and Google in-app purchases

## Scope restrictions

This project intentionally does not include backend infrastructure, WebSockets, matchmaking, or full game-rule implementations. Those concerns will be designed in later phases without polluting the initial mobile app foundation.
