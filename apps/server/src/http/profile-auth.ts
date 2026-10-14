import { createMiddleware } from 'hono/factory';
import { authenticateProfile } from '../profiles/profile-auth.ts';
import { apiError } from './api-error.ts';
import { parseBearerToken } from './bearer-token.ts';

export const requireProfileCredential = createMiddleware<{ Variables: { profileId: string } }>(
  async (c, next) => {
    const profileToken = parseBearerToken(c.req.header('Authorization'));
    const profileId = profileToken ? authenticateProfile(profileToken) : undefined;
    if (!profileId) {
      return c.json(apiError('invalid-credential', 'Valid profile credential required'), 401);
    }
    c.set('profileId', profileId);
    return next();
  },
);
