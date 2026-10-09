import { createMiddleware } from 'hono/factory';
import { authenticateProfile } from '../profiles/profile-auth.ts';
import { apiError } from './api-error.ts';

export const requireProfileCredential = createMiddleware<{ Variables: { profileId: string } }>(
  async (c, next) => {
    const profileToken = /^Bearer ([A-Za-z0-9_-]+)$/i.exec(
      c.req.header('Authorization') ?? '',
    )?.[1];
    const profileId = profileToken ? authenticateProfile(profileToken) : undefined;
    if (!profileId) {
      return c.json(apiError('invalid-credential', 'Valid profile credential required'), 401);
    }
    c.set('profileId', profileId);
    return next();
  },
);
