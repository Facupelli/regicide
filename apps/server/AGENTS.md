# Server Guidelines

## Role

`apps/server` is the authoritative application and transport layer around the game engine.

The game engine owns Regicide rules and legality. The server owns game sessions, player identity, transport, persistence, player-specific views, and publication of authoritative updates.

Do not duplicate game-engine rules in the server.

`packages/protocol` defines the client/server contract.

## HTTP API

- Keep route registration declarative: method, path, middleware, controller.
- Give each endpoint one controller that owns its HTTP contract.
- Controllers translate between HTTP and meaningful application operations: request data, authentication, validation, response bodies, headers, status codes, and application failures.
- Keep Hono types, HTTP status codes, headers, and transport details out of application/session logic.
- Validate untrusted input at the transport boundary and pass stronger values inward.
- Map application outcomes to HTTP responses explicitly and exhaustively.
- Use shared middleware only for genuinely cross-endpoint HTTP policy.

## Application and Sessions

- Express server behavior as meaningful operations such as create game, join game, start game, get game, and submit command.
- Keep session invariants and multi-step coordination behind the operation that owns them.
- Controllers must not orchestrate stores, hubs, engine transitions, and projections themselves.
- Keep one authoritative implementation of each session rule or transition.
- Prefer explicit result unions for expected failures over thrown exceptions.
- Throw only for unexpected invariant violations or infrastructure failures.
- Derive client views and events from authoritative state. Do not trust request data for facts the server already owns.
- Hide important ordering requirements such as mutate → revise → publish behind one operation.

## Boundaries

- The game engine must remain independent from Hono, sessions, persistence, sockets, and protocol presentation.
- Protocol mapping belongs at the boundary between authoritative server/game state and external representations.
- WebSocket connection lifecycle belongs to the transport/hub boundary, not to game rules.
- Development scenarios must remain peripheral to normal game behavior.

## Source Structure

Organize server code by application capability and ownership of policy. Keep endpoint-specific HTTP code beside its endpoint. Keep shared capabilities top-level only when they genuinely serve multiple operations. Do not create symmetric controller/service/repository layers or one-file-per-role structures.

## Testing

Test HTTP controllers for request validation, authentication, status codes, and protocol responses.

Test application/session operations without Hono when possible.

Test important HTTP/WebSocket coordination through integration tests.

## Avoid

- game rules implemented outside `packages/game-engine`;
- controllers containing session or game behavior;
- application code returning HTTP responses;
- generic service objects that become dumping grounds for unrelated operations;
- pass-through controller/service/repository layers;
- repeated authentication, validation, or error-mapping logic when one trusted boundary can own it;
- speculative ports, repositories, factories, or dependency injection without real variation;
- abstractions created only to reduce file size.
