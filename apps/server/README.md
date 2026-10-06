Run from the repository root:

```
pnpm install
pnpm run dev
```

The server listens on `http://localhost:3000`.

## Game lifecycle

- `POST /games` creates a lobby and returns `{ gameId, playerId, view }`. The returned player is the host.
- `POST /games/:gameId/join` adds a player to the lobby and returns `{ gameId, playerId, view }` (up to four players).
- `GET /games/:gameId` returns a lobby view, or a player-specific game view once play starts.
- `POST /games/:gameId/start` starts play for everyone in the lobby; only the host may call it.
- `POST /games/:gameId/actions` accepts a `PlayerCommand` JSON body once play starts.

**Temporary identity until player authentication is implemented:** send the caller's `playerId` in the `X-Player-Id` header for start, actions, and GET after the game starts. This header is only a caller-supplied identifier, not a credential; it does not prevent impersonation. Lobby GET needs no header.
