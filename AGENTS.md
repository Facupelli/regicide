# AGENTS.md

## Project

Regicide is a web implementation of the cooperative card game Regicide.

This is a pnpm TypeScript monorepo:

- `apps/web` — React SPA
- `apps/server` — Hono backend and authoritative game sessions
- `packages/game-engine` — pure Regicide rules and state transitions
- `packages/protocol` — shared client/server contracts

## Architecture

Game engine is independent from transport, UI, persistence, and frameworks.

The server is authoritative. Clients send player intentions; the server validates them, applies them through the game engine, and sends player-specific game views back.

## Package manager

Use `pnpm` from the repository root.

Do not create npm or yarn lockfiles inside workspace packages.
