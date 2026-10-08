import type { StartGameResponse } from '@regicide/protocol';
import type { Context } from 'hono';
import { gameService } from '../game-service.ts';
import { apiError } from '../../http/api-error.ts';

export function resetScenario(
  c: Context<{ Variables: { playerId: string } }, '/:gameId/reset-scenario'>,
) {
  const gameId = c.req.param('gameId');
  const result = gameService.resetDevScenario({ gameId, playerId: c.get('playerId') });
  if (!result.ok) {
    switch (result.reason) {
      case 'game-not-found':
        return c.json(apiError('game-not-found', 'Game not found'), 404);
      case 'game-not-started':
        return c.json(apiError('game-not-started', 'Game has not started'), 409);
      case 'player-not-in-game':
        return c.json(apiError('player-not-in-game', 'Player is not in the game'), 403);
      case 'not-host':
        return c.json(apiError('not-host', 'Only the host can reset the scenario'), 403);
      case 'scenarios-disabled':
        return c.json(apiError('scenarios-disabled', 'Dev scenarios are disabled'), 403);
      case 'not-scenario-game':
        return c.json(
          apiError('not-scenario-game', 'Game was not started from a dev scenario'),
          409,
        );
      case 'unknown-scenario':
        return c.json(apiError('unknown-scenario', 'Unknown dev scenario'), 409);
      case 'invalid-scenario':
        return c.json(apiError('invalid-scenario', result.message), 409);
    }
  }
  return c.json({ gameId, view: result.view } satisfies StartGameResponse);
}
