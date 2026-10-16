import { sValidator } from '@hono/standard-validator';
import {
  CreateGameRequestSchema,
  PLAYER_NAME_MAX_LENGTH,
  type CreateGameRequest,
  type CreateGameResponse,
} from '@regicide/protocol';
import type { Context } from 'hono';
import { apiError } from '../../http/api-error.ts';
import { parseBearerToken } from '../../http/bearer-token.ts';
import { authenticateProfile } from '../../profiles/profile-auth.ts';
import { createGame as createGameOperation } from './create-game.ts';

export const validateCreateGame = sValidator('json', CreateGameRequestSchema, (result, c) => {
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

export function createGame(c: Context<{}, '/', { out: { json: CreateGameRequest } }>) {
  const authorization = c.req.header('Authorization');
  const profileToken = parseBearerToken(authorization);
  const profileId = profileToken ? authenticateProfile(profileToken) : undefined;
  if (authorization !== undefined && !profileId) {
    return c.json(apiError('invalid-credential', 'Valid profile credential required'), 401);
  }

  const result = createGameOperation(c.req.valid('json').name, profileId);
  c.header('Location', `/games/${result.gameId}`);
  return c.json(result satisfies CreateGameResponse, 201);
}
