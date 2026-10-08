import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { apiError } from './http/api-error.ts';
import { gamesRoutes } from './games/http/routes.ts';

export const app = new Hono();

app.onError((error, c) => {
  if (error instanceof HTTPException && error.status === 400) {
    return c.json(apiError('invalid-request', 'Invalid request body'), 400);
  }
  if (error instanceof HTTPException && error.status >= 400 && error.status < 500) {
    return c.json(apiError('http-error', 'Invalid HTTP request'), error.status);
  }

  console.error(error);
  return c.json(apiError('internal-error', 'Internal server error'), 500);
});

app.notFound((c) => c.json(apiError('route-not-found', 'Route not found'), 404));

app.route('/games', gamesRoutes);
