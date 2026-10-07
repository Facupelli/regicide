# Regicide web client

Run from the repository root with `pnpm dev`. The web app is available at `http://localhost:3001` and proxies HTTP and WebSocket game traffic to the server at `http://localhost:3000`.

Start a solo game or create a co-op lobby. To join, enter the game ID shown in the host's lobby. The lobby updates live as players join. The host can start the game, and everyone enters play automatically over the same WebSocket.

During play, actions use authenticated HTTP requests and the game view is updated from personalized WebSocket snapshots. If the socket disconnects, the client retries and receives the latest snapshot on reconnect. Player tokens stay in memory only: a page refresh loses the client session.
