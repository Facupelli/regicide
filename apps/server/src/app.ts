import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requestId, type RequestIdVariables } from 'hono/request-id';
import { routePath } from 'hono/route';
import { logFailure } from './diagnostics.ts';
import { apiError } from './http/api-error.ts';
import { gamesRoutes } from './games/routes.ts';
import { profilesRoutes } from './profiles/routes.ts';

export const app = new Hono<{ Variables: RequestIdVariables }>();

app.use('*', requestId({ headerName: '' }));
app.use('*', async (c, next) => {
  await next();
  if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket' || c.res.status >= 400) {
    c.header('X-Request-Id', c.get('requestId'));
  }
});

app.onError((error, c) => {
  c.header('X-Request-Id', c.get('requestId'));
  if (error instanceof HTTPException && error.status === 400) {
    return c.json(apiError('invalid-request', 'Invalid request body'), 400);
  }
  if (error instanceof HTTPException && error.status >= 400 && error.status < 500) {
    return c.json(apiError('http-error', 'Invalid HTTP request'), error.status);
  }

  // 5xx HTTPExceptions reach this boundary and retain the existing generic 500 response.
  const registeredRoute = routePath(c);
  logFailure('error', {
    event: 'http.request.failed',
    requestId: c.get('requestId'),
    method: /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/.test(c.req.method)
      ? c.req.method
      : 'OTHER',
    route:
      registeredRoute.startsWith('/') && !registeredRoute.includes('*')
        ? registeredRoute
        : 'unmatched',
    status: error instanceof HTTPException ? error.status : 500,
  });
  return c.json(apiError('internal-error', 'Internal server error'), 500);
});

app.notFound((c) => c.json(apiError('route-not-found', 'Route not found'), 404));

app.route('/games', gamesRoutes);
app.route('/profiles', profilesRoutes);
