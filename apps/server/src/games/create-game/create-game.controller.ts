import type { CreateGameResponse } from '@regicide/protocol';
import type { Context } from 'hono';
import { apiError } from '../../http/api-error.ts';
import { parseBearerToken } from '../../http/bearer-token.ts';
import { authenticateProfile } from '../../profiles/profile-auth.ts';
import { createGame as createGameOperation } from './create-game.ts';

export function createGame(c: Context) {
  const authorization = c.req.header('Authorization');
  const profileToken = parseBearerToken(authorization);
  const profileId = profileToken ? authenticateProfile(profileToken) : undefined;
  if (authorization !== undefined && !profileId) {
    return c.json(apiError('invalid-credential', 'Valid profile credential required'), 401);
  }

  const result = createGameOperation(profileId);
  c.header('Location', `/games/${result.gameId}`);
  return c.json(result satisfies CreateGameResponse, 201);
}
