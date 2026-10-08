import { Hono } from 'hono';
import { requireJsonContentType } from '../../http/json-validation.ts';
import { requirePlayerCredential } from '../../http/player-auth.ts';
import { connectWebSocket } from './connect-websocket.ts';
import { createGame } from './create-game.ts';
import { getGame } from './get-game.ts';
import { joinGame } from './join-game.ts';
import { resetScenario } from './reset-scenario.ts';
import { startGame } from './start-game.ts';
import { submitAction, validateSubmitAction } from './submit-action.ts';

export const gamesRoutes = new Hono()
  .post('/', createGame)
  .get('/:gameId/ws', connectWebSocket)
  .get('/:gameId', getGame)
  .post('/:gameId/join', joinGame)
  .post('/:gameId/start', requirePlayerCredential, startGame)
  .post('/:gameId/reset-scenario', requirePlayerCredential, resetScenario)
  .post(
    '/:gameId/actions',
    requirePlayerCredential,
    requireJsonContentType,
    validateSubmitAction,
    submitAction,
  );
