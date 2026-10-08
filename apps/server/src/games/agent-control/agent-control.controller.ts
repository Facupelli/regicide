import { sValidator } from '@hono/standard-validator';
import { AgentConfigRequestSchema } from '@regicide/protocol';
import type { AddAgentResponse, AgentConfigRequest, AgentStatusResponse } from '@regicide/protocol';
import type { Context } from 'hono';
import { apiError } from '../../http/api-error.ts';
import {
  addAgent,
  configureAgent,
  getAgentStatus,
  retryAgent,
  revokeAgent,
} from './agent-control.ts';

type AuthorizedContext<Path extends string> = Context<{ Variables: { playerId: string } }, Path>;

function hostError(reason: 'game-not-found' | 'not-host') {
  return reason === 'game-not-found'
    ? { status: 404 as const, code: 'game-not-found', message: 'Game not found' }
    : { status: 403 as const, code: 'not-host', message: 'Only the host can manage agents' };
}

export function addAgentSlot(c: AuthorizedContext<'/:gameId/agents'>) {
  const gameId = c.req.param('gameId');
  const result = addAgent(gameId, c.get('playerId'));
  if (!result.ok) {
    if (result.reason === 'lobby-full') return c.json(apiError('lobby-full', 'Lobby is full'), 409);
    if (result.reason === 'game-already-started')
      return c.json(apiError('game-already-started', 'Game has already started'), 409);
    const { status, code, message } = hostError(result.reason);
    return c.json(apiError(code, message), status);
  }
  return c.json({ gameId, view: result.view } satisfies AddAgentResponse, 201);
}

export const validateAgentConfig = sValidator('json', AgentConfigRequestSchema, (result, c) => {
  if (!result.success) return c.json(apiError('invalid-request', 'Invalid request body'), 400);
  return undefined;
});

export function setAgentConfig(
  c: Context<
    { Variables: { playerId: string } },
    '/:gameId/agent/config',
    { out: { json: AgentConfigRequest } }
  >,
) {
  const result = configureAgent(c.req.param('gameId'), c.get('playerId'), c.req.valid('json'));
  if (!result.ok) {
    const { status, code, message } = hostError(result.reason);
    return c.json(apiError(code, message), status);
  }
  return c.body(null, 204);
}

export function deleteAgentConfig(c: AuthorizedContext<'/:gameId/agent/config'>) {
  const result = revokeAgent(c.req.param('gameId'), c.get('playerId'));
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
      case 'not-configured':
        return c.json(apiError('not-configured', 'Agent configuration required'), 409);
      case 'already-running':
        return c.json(apiError('already-running', 'An agent decision is running'), 409);
      case 'budget-exhausted':
        return c.json(apiError('budget-exhausted', 'Model request budget exhausted'), 409);
    }
  }
  return c.json({ gameId, status: result.status } satisfies AgentStatusResponse);
}
