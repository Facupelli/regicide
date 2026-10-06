import { randomBytes, randomUUID } from 'node:crypto';
import { sValidator } from '@hono/standard-validator';
import { setupGame } from '@regicide/game-engine';
import {
  SubmitActionRequestSchema,
  type CreateGameResponse,
  type GetGameResponse,
  type SubmitActionResponse,
} from '@regicide/protocol';
import { Hono } from 'hono';
import { toGameView } from '../adapters/game-view.ts';
import { gameService } from '../games/game-service.ts';
import { gameStore } from '../games/game-store.ts';
import { apiError } from '../http/api-error.ts';
import { requireJsonContentType } from '../http/json-validation.ts';

export const gamesRoutes = new Hono()
  .post('/', (c) => {
    const gameId = randomUUID();
    const playerId = randomUUID();
    const rngState = randomBytes(4).readUInt32BE(0);
    const state = setupGame({ playerIds: [playerId], rngState });
    gameStore.set(gameId, { playerId, state });

    c.header('Location', `/games/${gameId}`);
    return c.json({ gameId, view: toGameView(state, playerId) } satisfies CreateGameResponse, 201);
  })
  .get('/:gameId', (c) => {
    const gameId = c.req.param('gameId');
    const session = gameStore.get(gameId);
    if (!session) return c.json(apiError('game-not-found', 'Game not found'), 404);

    return c.json({
      gameId,
      view: toGameView(session.state, session.playerId),
    } satisfies GetGameResponse);
  })
  .post(
    '/:gameId/actions',
    requireJsonContentType,
    sValidator('json', SubmitActionRequestSchema, (result, c) => {
      if (!result.success) return c.json(apiError('invalid-request', 'Invalid request body'), 400);
      return undefined;
    }),
    (c) => {
      const command = c.req.valid('json');
      const gameId = c.req.param('gameId');
      const session = gameStore.get(gameId);
      if (!session) return c.json(apiError('game-not-found', 'Game not found'), 404);

      const result = gameService.submitCommand({ gameId, playerId: session.playerId, command });
      if (!result.ok) {
        if (result.reason === 'game-not-found') {
          return c.json(apiError('game-not-found', 'Game not found'), 404);
        }
        return c.json(apiError('invalid-action', result.message), 409);
      }

      return c.json({ gameId, view: result.view } satisfies SubmitActionResponse);
    },
  );
