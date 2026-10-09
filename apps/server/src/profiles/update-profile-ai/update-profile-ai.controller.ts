import { sValidator } from '@hono/standard-validator';
import { UpdateProfileAiRequestSchema } from '@regicide/protocol';
import type { UpdateProfileAiRequest } from '@regicide/protocol';
import type { Context } from 'hono';
import { apiError } from '../../http/api-error.ts';
import { updateProfileAi as updateProfileAiOperation } from './update-profile-ai.ts';

export const validateUpdateProfileAi = sValidator(
  'json',
  UpdateProfileAiRequestSchema,
  (result, c) => {
    if (!result.success) {
      return c.json(apiError('invalid-request', 'Invalid request body'), 400);
    }
    return undefined;
  },
);

export function updateProfileAi(
  c: Context<
    { Variables: { profileId: string } },
    '/me/ai',
    { out: { json: UpdateProfileAiRequest } }
  >,
) {
  updateProfileAiOperation(c.get('profileId'), c.req.valid('json'));
  return c.body(null, 204);
}
