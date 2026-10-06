import { sValidator } from '@hono/standard-validator';
import {
  SubmitActionRequestSchema,
  type CreateGameResponse,
  type GetGameResponse,
  type JoinGameResponse,
  type StartGameResponse,
  type SubmitActionResponse,
} from '@regicide/protocol';
import { Hono } from 'hono';
import { gameService } from '../games/game-service.ts';
import { apiError } from '../http/api-error.ts';
import { requireJsonContentType } from '../http/json-validation.ts';

// Temporary caller-supplied identity until player authentication is introduced.
const playerIdHeader = 'X-Player-Id';

export const gamesRoutes = new Hono()
  .post('/', (c) => {
    const result = gameService.createGame();
    c.header('Location', `/games/${result.gameId}`);
    return c.json(result satisfies CreateGameResponse, 201);
  })
  .get('/:gameId', (c) => {
    const gameId = c.req.param('gameId');
    const result = gameService.getGame({ gameId, playerId: c.req.header(playerIdHeader) });
    if (!result.ok) {
      switch (result.reason) {
        case 'game-not-found':
          return c.json(apiError('game-not-found', 'Game not found'), 404);
        case 'player-id-required':
          return c.json(apiError('invalid-request', 'X-Player-Id is required'), 400);
        case 'player-not-in-game':
          return c.json(apiError('player-not-in-game', 'Player is not in the game'), 403);
      }
    }
    return c.json({ gameId, view: result.view } satisfies GetGameResponse);
  })
  .post('/:gameId/join', (c) => {
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
      { gameId, playerId: result.playerId, view: result.view } satisfies JoinGameResponse,
      201,
    );
  })
  .post('/:gameId/start', (c) => {
    const gameId = c.req.param('gameId');
    const playerId = c.req.header(playerIdHeader);
    if (!playerId) return c.json(apiError('invalid-request', 'X-Player-Id is required'), 400);

    const result = gameService.startGame({ gameId, playerId });
    if (!result.ok) {
      switch (result.reason) {
        case 'game-not-found':
          return c.json(apiError('game-not-found', 'Game not found'), 404);
        case 'game-already-started':
          return c.json(apiError('game-already-started', 'Game has already started'), 409);
        case 'not-host':
          return c.json(apiError('not-host', 'Only the host can start the game'), 403);
      }
    }
    return c.json({ gameId, view: result.view } satisfies StartGameResponse);
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
      const playerId = c.req.header(playerIdHeader);
      if (!playerId) return c.json(apiError('invalid-request', 'X-Player-Id is required'), 400);

      const result = gameService.submitCommand({ gameId, playerId, command });
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
    },
  );
