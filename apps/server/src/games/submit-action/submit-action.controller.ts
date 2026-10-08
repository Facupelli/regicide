import { sValidator } from '@hono/standard-validator';
import { SubmitActionRequestSchema } from '@regicide/protocol';
import type { SubmitActionRequest, SubmitActionResponse } from '@regicide/protocol';
import type { Context } from 'hono';
import { apiError } from '../../http/api-error.ts';
import { submitCommand } from './submit-command.ts';

export const validateSubmitAction = sValidator('json', SubmitActionRequestSchema, (result, c) => {
  if (!result.success) return c.json(apiError('invalid-request', 'Invalid request body'), 400);
  return undefined;
});

export function submitAction(
  c: Context<
    { Variables: { playerId: string } },
    '/:gameId/actions',
    { out: { json: SubmitActionRequest } }
  >,
) {
  const command = c.req.valid('json');
  const gameId = c.req.param('gameId');
  const result = submitCommand({ gameId, playerId: c.get('playerId'), command });
  if (!result.ok) {
    switch (result.reason) {
      case 'game-not-found':
        return c.json(apiError('game-not-found', 'Game not found'), 404);
      case 'game-not-started':
        return c.json(apiError('game-not-started', 'Game has not started'), 409);
      case 'player-not-in-game':
        return c.json(apiError('player-not-in-game', 'Player is not in the game'), 403);
      case 'invalid-action':
        return c.json(apiError('invalid-action', result.message), 409);
    }
  }

  return c.json({ gameId, view: result.view } satisfies SubmitActionResponse);
}
