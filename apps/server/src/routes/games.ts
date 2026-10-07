import { upgradeWebSocket } from '@hono/node-server';
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
import { gameHub } from '../games/game-hub.ts';
import { gameService } from '../games/game-service.ts';
import { authenticatePlayer } from '../games/player-auth.ts';
import { apiError } from '../http/api-error.ts';
import { requireJsonContentType } from '../http/json-validation.ts';
import { authenticateBearerPlayer, requirePlayerCredential } from '../http/player-auth.ts';

export const gamesRoutes = new Hono()
  .post('/', (c) => {
    const result = gameService.createGame();
    c.header('Location', `/games/${result.gameId}`);
    return c.json(result satisfies CreateGameResponse, 201);
  })
  .get('/:gameId/ws', async (c) => {
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
  })
  .get('/:gameId', (c) => {
    const gameId = c.req.param('gameId');
    // The lobby remains public. A playing game requires authentication before its view is read.
    const publicResult = gameService.getGame({ gameId, playerId: undefined });
    if (!publicResult.ok && publicResult.reason === 'game-not-found') {
      return c.json(apiError('game-not-found', 'Game not found'), 404);
    }
    if (publicResult.ok) {
      return c.json({ gameId, view: publicResult.view } satisfies GetGameResponse);
    }

    const identity = authenticateBearerPlayer({
      gameId,
      authorization: c.req.header('Authorization'),
    });
    if (!identity.ok) {
      if (identity.reason === 'game-not-found') {
        return c.json(apiError('game-not-found', 'Game not found'), 404);
      }
      return c.json(apiError('invalid-credential', 'Valid player credential required'), 401);
    }
    const result = gameService.getGame({ gameId, playerId: identity.playerId });
    if (!result.ok) {
      switch (result.reason) {
        case 'game-not-found':
          return c.json(apiError('game-not-found', 'Game not found'), 404);
        case 'player-id-required':
          return c.json(apiError('invalid-credential', 'Valid player credential required'), 401);
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
      {
        gameId,
        playerId: result.playerId,
        playerToken: result.playerToken,
        view: result.view,
      } satisfies JoinGameResponse,
      201,
    );
  })
  .post('/:gameId/start', requirePlayerCredential, (c) => {
    const gameId = c.req.param('gameId');
    const result = gameService.startGame({
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
  })
  .post(
    '/:gameId/actions',
    requirePlayerCredential,
    requireJsonContentType,
    sValidator('json', SubmitActionRequestSchema, (result, c) => {
      if (!result.success) return c.json(apiError('invalid-request', 'Invalid request body'), 400);
      return undefined;
    }),
    (c) => {
      const command = c.req.valid('json');
      const gameId = c.req.param('gameId');
      const result = gameService.submitCommand({ gameId, playerId: c.get('playerId'), command });
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
