import type { ProfileView } from '@regicide/protocol';
import type { Context } from 'hono';
import { readProfile as readProfileOperation } from './read-profile.ts';

export function readProfile(c: Context<{ Variables: { profileId: string } }>) {
  return c.json(readProfileOperation(c.get('profileId')) satisfies ProfileView);
}
