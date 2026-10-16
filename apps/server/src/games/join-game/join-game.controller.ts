import { sValidator } from '@hono/standard-validator';
import {
  JoinGameRequestSchema,
  PLAYER_NAME_MAX_LENGTH,
  type JoinGameRequest,
  type JoinGameResponse,
} from '@regicide/protocol';
import type { Context } from 'hono';
import { apiError } from '../../http/api-error.ts';
import { joinGame as joinGameOperation } from './join-game.ts';

export const validateJoinGame = sValidator('json', JoinGameRequestSchema, (result, c) => {
  if (!result.success) {
    return c.json(
      apiError(
        'invalid-request',
        `Enter a nickname of 1 to ${PLAYER_NAME_MAX_LENGTH} characters without control characters`,
      ),
      400,
    );
  }
  return undefined;
});

export function joinGame(c: Context<{}, '/:gameId/join', { out: { json: JoinGameRequest } }>) {
  const gameId = c.req.param('gameId');
  const result = joinGameOperation({ gameId, name: c.req.valid('json').name });
  if (!result.ok) {
    switch (result.reason) {
      case 'game-not-found':
        return c.json(apiError('game-not-found', 'Game not found'), 404);
      case 'game-already-started':
        return c.json(apiError('game-already-started', 'Game has already started'), 409);
      case 'lobby-full':
        return c.json(apiError('lobby-full', 'Lobby is full'), 409);
      case 'name-taken':
        return c.json(apiError('name-taken', 'Nickname is already taken in this game'), 409);
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
