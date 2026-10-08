import type { StartGameResponse } from '@regicide/protocol';
import type { Context } from 'hono';
import { apiError } from '../../http/api-error.ts';
import { startGame as startGameOperation } from './start-game.ts';

export function startGame(c: Context<{ Variables: { playerId: string } }, '/:gameId/start'>) {
  const gameId = c.req.param('gameId');
  const result = startGameOperation({
    gameId,
    playerId: c.get('playerId'),
    scenario: c.req.query('scenario'),
  });
  if (!result.ok) {
    switch (result.reason) {
      case 'game-not-found':
        return c.json(apiError('game-not-found', 'Game not found'), 404);
      case 'game-already-started':
        return c.json(apiError('game-already-started', 'Game has already started'), 409);
      case 'player-not-in-game':
        return c.json(apiError('player-not-in-game', 'Player is not in the game'), 403);
      case 'not-host':
        return c.json(apiError('not-host', 'Only the host can start the game'), 403);
      case 'scenarios-disabled':
        return c.json(apiError('scenarios-disabled', 'Dev scenarios are disabled'), 403);
      case 'unknown-scenario':
        return c.json(apiError('unknown-scenario', 'Unknown dev scenario'), 400);
      case 'invalid-scenario':
        return c.json(apiError('invalid-scenario', result.message), 400);
    }
  }
  return c.json({ gameId, view: result.view } satisfies StartGameResponse);
}
