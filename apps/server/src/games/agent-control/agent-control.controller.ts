import { sValidator } from '@hono/standard-validator';
import { AddAgentRequestSchema, UpdateGameAgentSettingsRequestSchema } from '@regicide/protocol';
import type {
  AddAgentRequest,
  AddAgentResponse,
  AgentStatusResponse,
  UpdateGameAgentSettingsRequest,
  RemoveAgentResponse,
} from '@regicide/protocol';
import type { Context } from 'hono';
import { apiError } from '../../http/api-error.ts';
import {
  addAgent,
  getAgentStatus,
  removeAgent,
  retryAgent,
  updateAgentSettings,
} from './agent-control.ts';

type AuthorizedContext<Path extends string> = Context<{ Variables: { playerId: string } }, Path>;

function hostError(reason: 'game-not-found' | 'not-host') {
  return reason === 'game-not-found'
    ? { status: 404 as const, code: 'game-not-found', message: 'Game not found' }
    : { status: 403 as const, code: 'not-host', message: 'Only the host can manage agents' };
}

export const validateAddAgent = sValidator('json', AddAgentRequestSchema, (result, c) => {
  if (!result.success) {
    return c.json(apiError('invalid-request', 'Invalid request body'), 400);
  }
  return undefined;
});

export function addAgentSlot(
  c: Context<
    { Variables: { playerId: string } },
    '/:gameId/agents',
    { out: { json: AddAgentRequest } }
  >,
) {
  const gameId = c.req.param('gameId');
  const result = addAgent(gameId, c.get('playerId'), c.req.valid('json').model);
  if (!result.ok) {
    if (result.reason === 'lobby-full') {
      return c.json(apiError('lobby-full', 'Lobby is full'), 409);
    }
    if (result.reason === 'game-already-started') {
      return c.json(apiError('game-already-started', 'Game has already started'), 409);
    }
    if (result.reason === 'profile-required') {
      return c.json(apiError('profile-required', 'Host profile required to add AI players'), 409);
    }
    if (result.reason === 'model-not-enabled') {
      return c.json(apiError('model-not-enabled', 'Model is not enabled in the host profile'), 409);
    }
    const { status, code, message } = hostError(result.reason);
    return c.json(apiError(code, message), status);
  }
  return c.json({ gameId, view: result.view } satisfies AddAgentResponse, 201);
}

export function removeAgentSlot(c: AuthorizedContext<'/:gameId/agents/:agentId'>) {
  const gameId = c.req.param('gameId');
  const result = removeAgent(gameId, c.get('playerId'), c.req.param('agentId'));
  if (!result.ok) {
    if (result.reason === 'game-already-started') {
      return c.json(apiError('game-already-started', 'Game has already started'), 409);
    }
    if (result.reason === 'agent-not-found') {
      return c.json(apiError('agent-not-found', 'Player slot not found'), 404);
    }
    if (result.reason === 'not-agent') {
      return c.json(apiError('not-agent', 'Cannot remove a human player'), 409);
    }
    const { status, code, message } = hostError(result.reason);
    return c.json(apiError(code, message), status);
  }
  return c.json({ gameId, view: result.view } satisfies RemoveAgentResponse);
}

export const validateAgentSettings = sValidator(
  'json',
  UpdateGameAgentSettingsRequestSchema,
  (result, c) => {
    if (!result.success) {
      return c.json(apiError('invalid-request', 'Invalid request body'), 400);
    }
    return undefined;
  },
);

export function setAgentSettings(
  c: Context<
    { Variables: { playerId: string } },
    '/:gameId/agent/settings',
    { out: { json: UpdateGameAgentSettingsRequest } }
  >,
) {
  const result = updateAgentSettings(c.req.param('gameId'), c.get('playerId'), c.req.valid('json'));
  if (!result.ok) {
    const { status, code, message } = hostError(result.reason);
    return c.json(apiError(code, message), status);
  }
  return c.body(null, 204);
}

export function readAgentStatus(c: AuthorizedContext<'/:gameId/agent'>) {
  const gameId = c.req.param('gameId');
  const result = getAgentStatus(gameId, c.get('playerId'));
  if (!result.ok) {
    const { status, code, message } = hostError(result.reason);
    return c.json(apiError(code, message), status);
  }
  return c.json({ gameId, status: result.status } satisfies AgentStatusResponse);
}

export function retryAgentDecision(c: AuthorizedContext<'/:gameId/agent/retry'>) {
  const gameId = c.req.param('gameId');
  const result = retryAgent(gameId, c.get('playerId'));
  if (!result.ok) {
    if (result.reason === 'game-not-found' || result.reason === 'not-host') {
      const { status, code, message } = hostError(result.reason);
      return c.json(apiError(code, message), status);
    }
    switch (result.reason) {
      case 'no-pending-agent':
        return c.json(apiError('no-pending-agent', 'No agent decision is pending'), 409);
      case 'already-running':
        return c.json(apiError('already-running', 'An agent decision is running'), 409);
      case 'budget-exhausted':
        return c.json(apiError('budget-exhausted', 'Model request budget exhausted'), 409);
      case 'stopped':
        return c.json(apiError('agent-stopped', 'AI execution is stopped'), 409);
      case 'missing-profile':
      case 'missing-key':
      case 'model-disabled':
        return c.json(apiError(result.reason, 'Profile configuration required'), 409);
    }
  }
  return c.json({ gameId, status: result.status } satisfies AgentStatusResponse);
}
