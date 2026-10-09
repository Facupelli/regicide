import type { Context } from 'hono';
import { revokeProfileAi as revokeProfileAiOperation } from './revoke-profile-ai.ts';

export function revokeProfileAi(c: Context<{ Variables: { profileId: string } }>) {
  revokeProfileAiOperation(c.get('profileId'));
  return c.body(null, 204);
}
