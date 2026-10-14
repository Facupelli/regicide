import { serve, type WebSocketServerLike } from '@hono/node-server';
import { WebSocketServer } from 'ws';
import { app } from './app.ts';

function isUpgradeServer(server: WebSocketServer): server is WebSocketServer & WebSocketServerLike {
  return server.options.noServer === true;
}

const configuredPort = process.env.PORT;
const port = configuredPort === undefined ? 3000 : Number(configuredPort);
if (
  (configuredPort !== undefined && !/^[0-9]+$/.test(configuredPort)) ||
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const websocketServer = new WebSocketServer({ noServer: true });
if (!isUpgradeServer(websocketServer)) {
  throw new Error('WebSocket upgrades must be handled by Hono');
}

serve(
  {
    fetch: app.fetch,
    port,
    hostname: '0.0.0.0',
    websocket: { server: websocketServer },
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
