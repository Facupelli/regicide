import { createMiddleware } from 'hono/factory';
import { apiError } from './api-error.ts';

export const requireJsonContentType = createMiddleware(async (c, next) => {
  const contentType = c.req.header('Content-Type');
  if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(contentType ?? '')) {
    return c.json(apiError('unsupported-media-type', 'Content-Type must be application/json'), 415);
  }
  return next();
});
