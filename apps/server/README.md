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

Create and join issue a game-scoped secret `playerToken` once. Keep it private; player IDs in views are public and cannot authenticate requests. Send `Authorization: Bearer <playerToken>` for start, actions, and GET after the game starts. Lobby GET is public and needs no credential. Tokens are held in memory only; there is no reconnect support.
