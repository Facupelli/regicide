Run from the repository root:

```
pnpm install
pnpm run dev
```

The server listens on `http://localhost:3000`.

## Game lifecycle

- `POST /games` creates a lobby and returns `{ gameId, playerId, playerToken, view }`. The returned player is the host.
- `POST /games/:gameId/join` adds a player to the lobby and returns `{ gameId, playerId, playerToken, view }` (up to four players).
- `GET /games/:gameId` returns a lobby view, or a player-specific game view once play starts.
- `POST /games/:gameId/start` starts play for everyone in the lobby; only the host may call it.
- `POST /games/:gameId/actions` accepts a `PlayerCommand` JSON body once play starts.
- `GET /games/:gameId/ws?playerToken=<token>` upgrades to an authenticated WebSocket in either lobby or playing phase. Each socket receives an immediate snapshot: `{ type: 'lobby-updated', view }` in the lobby or `{ type: 'game-updated', revision, view, events }` during play. `events` is always an array, empty for snapshots and updates with no events. A successful nonempty damage discard includes a public `cardsDiscardedForDamage` event with a session-scoped increasing integer ID, player ID, and cards in discard-pile order. Joining publishes a lobby update; starting and successful HTTP actions publish player-specific game updates with the same public events for every player. Sockets remain open across start. Reconnecting sends the current snapshot with `events: []`; there is no event replay.

## AI teammates

AI setup through the UI is incomplete. Create a profile (`POST /profiles`), save its OpenRouter
key and enabled models (`PUT /profiles/me/ai`), and create the game with the profile bearer token
in the Authorization header. The game still issues its own player token. Hosts can add AI slots
with individually selected enabled models (`POST /games/:gameId/agents`), configure the shared
request budget and Stop/Resume execution (`PUT /games/:gameId/agent/settings`), read execution
status (`GET /games/:gameId/agent`), and retry a blocked or failed decision
(`POST /games/:gameId/agent/retry`). Model requests can incur charges. Profile credentials never
belong to the game; see `packages/protocol/src/api.ts` for request contracts.

AI logs are concise by default. Set `AI_DEBUG=true` in the server environment for detailed
coordinator, game-state, observation, and provider diagnostics. Both modes redact credentials;
verbose logs can include hidden game information and model-generated text, so handle them securely.

Create and join issue a game-scoped secret `playerToken` once. Keep it private; player IDs in views are public and cannot authenticate requests. Send `Authorization: Bearer <playerToken>` for start, actions, and GET after the game starts. Lobby GET is public and needs no credential. Tokens are held in memory only. Browser WebSockets cannot set an Authorization header, so the WebSocket upgrade uses a `playerToken` query parameter; keep URL query strings out of access logs. The token remains required for reconnects during the lifetime of the server process.
