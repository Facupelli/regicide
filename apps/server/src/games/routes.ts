import { Hono } from 'hono';
import { requireJsonContentType } from '../http/json-validation.ts';
import { requirePlayerCredential } from '../http/player-auth.ts';
import {
  addAgentSlot,
  readAgentStatus,
  removeAgentSlot,
  retryAgentDecision,
  setAgentSettings,
  validateAddAgent,
  validateAgentSettings,
} from './agent-control/agent-control.controller.ts';
import { connectWebSocket } from './connect-websocket/connect-websocket.controller.ts';
import { createGame } from './create-game/create-game.controller.ts';
import { getGame } from './get-game/get-game.controller.ts';
import { joinGame } from './join-game/join-game.controller.ts';
import { startGame } from './start-game/start-game.controller.ts';
import { submitAction, validateSubmitAction } from './submit-action/submit-action.controller.ts';

export const gamesRoutes = new Hono()
  .post('/', createGame)
  .get('/:gameId/ws', connectWebSocket)
  .get('/:gameId', getGame)
  .post('/:gameId/join', joinGame)
  .post(
    '/:gameId/agents',
    requirePlayerCredential,
    requireJsonContentType,
    validateAddAgent,
    addAgentSlot,
  )
  .delete('/:gameId/agents/:agentId', requirePlayerCredential, removeAgentSlot)
  .put(
    '/:gameId/agent/settings',
    requirePlayerCredential,
    requireJsonContentType,
    validateAgentSettings,
    setAgentSettings,
  )
  .get('/:gameId/agent', requirePlayerCredential, readAgentStatus)
  .post('/:gameId/agent/retry', requirePlayerCredential, retryAgentDecision)
  .post('/:gameId/start', requirePlayerCredential, startGame)
  .post(
    '/:gameId/actions',
    requirePlayerCredential,
    requireJsonContentType,
    validateSubmitAction,
    submitAction,
  );
