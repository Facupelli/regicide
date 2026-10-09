import type { Context } from 'hono';
import { createProfile as createProfileOperation } from './create-profile.ts';

export function createProfile(c: Context) {
  const result = createProfileOperation();
  c.header('Location', '/profiles/me');
  return c.json(result, 201);
}
