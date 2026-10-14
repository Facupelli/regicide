import type { GetGameResponse } from '@regicide/protocol';
import type { Context } from 'hono';
import { apiError } from '../../http/api-error.ts';
import { parseBearerToken } from '../../http/bearer-token.ts';
import { getGame as getGameOperation } from './get-game.ts';

export function getGame(c: Context<{}, '/:gameId'>) {
  const gameId = c.req.param('gameId');
  const playerToken = parseBearerToken(c.req.header('Authorization'));
  const result = getGameOperation({ gameId, playerToken });
  if (!result.ok) {
    switch (result.reason) {
      case 'game-not-found':
        return c.json(apiError('game-not-found', 'Game not found'), 404);
      case 'invalid-credential':
        return c.json(apiError('invalid-credential', 'Valid player credential required'), 401);
    }
  }
  return c.json({ gameId, view: result.view } satisfies GetGameResponse);
}
