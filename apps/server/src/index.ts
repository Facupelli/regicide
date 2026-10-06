import { serve, type WebSocketServerLike } from '@hono/node-server';
import { WebSocketServer } from 'ws';
import { app } from './app.ts';

function isUpgradeServer(server: WebSocketServer): server is WebSocketServer & WebSocketServerLike {
  return server.options.noServer === true;
}

const websocketServer = new WebSocketServer({ noServer: true });
if (!isUpgradeServer(websocketServer))
  throw new Error('WebSocket upgrades must be handled by Hono');

serve(
  {
    fetch: app.fetch,
    port: 3000,
    websocket: { server: websocketServer },
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
