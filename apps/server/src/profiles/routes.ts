import { Hono } from 'hono';
import { requireJsonContentType } from '../http/json-validation.ts';
import { requireProfileCredential } from '../http/profile-auth.ts';
import { createProfile } from './create-profile/create-profile.controller.ts';
import { readProfile } from './read-profile/read-profile.controller.ts';
import { revokeProfileAi } from './revoke-profile-ai/revoke-profile-ai.controller.ts';
import {
  updateProfileAi,
  validateUpdateProfileAi,
} from './update-profile-ai/update-profile-ai.controller.ts';

export const profilesRoutes = new Hono()
  .post('/', createProfile)
  .get('/me', requireProfileCredential, readProfile)
  .put(
    '/me/ai',
    requireProfileCredential,
    requireJsonContentType,
    validateUpdateProfileAi,
    updateProfileAi,
  )
  .delete('/me/ai', requireProfileCredential, revokeProfileAi);
