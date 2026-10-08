import type { JoinGameResponse } from '@regicide/protocol';
import type { Context } from 'hono';
import { gameService } from '../game-service.ts';
import { apiError } from '../../http/api-error.ts';

export function joinGame(c: Context<{}, '/:gameId/join'>) {
  const gameId = c.req.param('gameId');
  const result = gameService.joinGame({ gameId });
  if (!result.ok) {
    switch (result.reason) {
      case 'game-not-found':
        return c.json(apiError('game-not-found', 'Game not found'), 404);
      case 'game-already-started':
        return c.json(apiError('game-already-started', 'Game has already started'), 409);
      case 'lobby-full':
        return c.json(apiError('lobby-full', 'Lobby is full'), 409);
    }
  }
  return c.json(
    {
      gameId,
      playerId: result.playerId,
      playerToken: result.playerToken,
      view: result.view,
    } satisfies JoinGameResponse,
    201,
  );
}
