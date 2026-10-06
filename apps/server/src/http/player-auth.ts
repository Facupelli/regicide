import { createMiddleware } from 'hono/factory';
import { authenticatePlayer, type AuthenticatePlayerResult } from '../games/player-auth.ts';
import { apiError } from './api-error.ts';

export function authenticateBearerPlayer({
  gameId,
  authorization,
}: {
  gameId: string;
  authorization: string | undefined;
}): AuthenticatePlayerResult {
  const match = /^Bearer ([A-Za-z0-9_-]+)$/i.exec(authorization ?? '');
  const playerToken = match?.[1];
  if (!playerToken) return { ok: false, reason: 'invalid-credential' };
  return authenticatePlayer({ gameId, playerToken });
}

export const requirePlayerCredential = createMiddleware<{ Variables: { playerId: string } }>(
  async (c, next) => {
    const result = authenticateBearerPlayer({
      gameId: c.req.param('gameId') ?? '',
      authorization: c.req.header('Authorization'),
    });
    if (!result.ok) {
      if (result.reason === 'game-not-found') {
        return c.json(apiError('game-not-found', 'Game not found'), 404);
      }
      return c.json(apiError('invalid-credential', 'Valid player credential required'), 401);
    }
    c.set('playerId', result.playerId);
    return next();
  },
);
