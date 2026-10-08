import { upgradeWebSocket } from '@hono/node-server';
import type { Context } from 'hono';
import { gameHub } from '../game-hub.ts';
import { authenticatePlayer } from '../player-auth.ts';
import { apiError } from '../../http/api-error.ts';

export async function connectWebSocket(c: Context<{}, '/:gameId/ws'>) {
  const gameId = c.req.param('gameId');
  const identity = authenticatePlayer({ gameId, playerToken: c.req.query('playerToken') ?? '' });
  if (!identity.ok) {
    if (identity.reason === 'game-not-found') {
      return c.json(apiError('game-not-found', 'Game not found'), 404);
    }
    return c.json(apiError('invalid-credential', 'Valid player credential required'), 401);
  }
  if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') {
    return c.json(apiError('invalid-request', 'WebSocket upgrade required'), 400);
  }

  const playerId = identity.playerId;
  return await upgradeWebSocket(c, {
    onOpen(_event, socket) {
      gameHub.connect(gameId, playerId, socket);
    },
    onClose(_event, socket) {
      gameHub.disconnect(gameId, playerId, socket);
    },
  });
}
