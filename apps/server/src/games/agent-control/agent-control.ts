import { randomUUID } from 'node:crypto';
import type { LobbyView } from '@regicide/protocol';
import {
  agentRuntime,
  invalidateAgentConfig,
  type AgentConfig,
  type AgentFailure,
} from '../../agents/agent-runtime.ts';
import { scheduleAgentTurn } from '../../agents/agent-turn-runner.ts';
import { gameHub } from '../game-hub.ts';
import { gameStore } from '../game-store.ts';
import { toLobbyView } from '../protocol/lobby-view.ts';

type HostFailure = { ok: false; reason: 'game-not-found' | 'not-host' };
type OperationFailure = HostFailure | { ok: false; reason: 'game-already-started' | 'lobby-full' };

type AgentStatus =
  | {
      state: 'unconfigured' | 'ready' | 'running' | 'budget-exhausted';
      requestsUsed: number;
      maxRequests: number | null;
    }
  | { state: 'failed'; reason: AgentFailure; requestsUsed: number; maxRequests: number | null };

function hostSession(gameId: string, playerId: string) {
  const session = gameStore.get(gameId);
  if (!session) return { ok: false as const, reason: 'game-not-found' as const };
  if (session.hostPlayerId !== playerId) return { ok: false as const, reason: 'not-host' as const };
  return { ok: true as const, session };
}

export function addAgent(
  gameId: string,
  playerId: string,
): { ok: true; view: LobbyView } | OperationFailure {
  const host = hostSession(gameId, playerId);
  if (!host.ok) return host;
  const { session } = host;
  if (session.phase !== 'lobby') return { ok: false, reason: 'game-already-started' };
  if (session.players.length >= 4) return { ok: false, reason: 'lobby-full' };
  session.players.push({ id: randomUUID(), controller: 'agent' });
  const view = toLobbyView(session);
  gameHub.publishLobby(gameId, view);
  return { ok: true, view };
}

export function configureAgent(
  gameId: string,
  playerId: string,
  config: AgentConfig,
): { ok: true } | HostFailure {
  const host = hostSession(gameId, playerId);
  if (!host.ok) return host;
  const runtime = agentRuntime(gameId);
  invalidateAgentConfig(runtime);
  runtime.config = config;
  scheduleAgentTurn(gameId);
  return { ok: true };
}

export function revokeAgent(gameId: string, playerId: string): { ok: true } | HostFailure {
  const host = hostSession(gameId, playerId);
  if (!host.ok) return host;
  const runtime = agentRuntime(gameId);
  invalidateAgentConfig(runtime);
  runtime.config = undefined;
  return { ok: true };
}

export function getAgentStatus(
  gameId: string,
  playerId: string,
): { ok: true; status: AgentStatus } | HostFailure {
  const host = hostSession(gameId, playerId);
  if (!host.ok) return host;
  const runtime = agentRuntime(gameId);
  const { session } = host;
  const requestsUsed = runtime.requestsUsed;
  const maxRequests = runtime.config?.maxRequests ?? null;
  if (
    runtime.failure &&
    session.phase === 'playing' &&
    runtime.failure.session === session &&
    runtime.failure.revision === session.revision &&
    session.state.kind === 'active' &&
    runtime.failure.playerId === session.state.world.currentPlayer
  ) {
    return {
      ok: true,
      status: { state: 'failed', reason: runtime.failure.reason, requestsUsed, maxRequests },
    };
  }
  if (!runtime.config)
    return { ok: true, status: { state: 'unconfigured', requestsUsed, maxRequests } };
  if (runtime.inFlight)
    return { ok: true, status: { state: 'running', requestsUsed, maxRequests } };
  if (requestsUsed >= runtime.config.maxRequests) {
    return { ok: true, status: { state: 'budget-exhausted', requestsUsed, maxRequests } };
  }
  return { ok: true, status: { state: 'ready', requestsUsed, maxRequests } };
}

export function retryAgent(
  gameId: string,
  playerId: string,
):
  | { ok: true; status: AgentStatus }
  | HostFailure
  | {
      ok: false;
      reason: 'no-pending-agent' | 'not-configured' | 'already-running' | 'budget-exhausted';
    } {
  const host = hostSession(gameId, playerId);
  if (!host.ok) return host;
  const { session } = host;
  if (
    session.phase !== 'playing' ||
    session.state.kind !== 'active' ||
    !session.players.some(
      (player) => player.id === session.state.world.currentPlayer && player.controller === 'agent',
    )
  ) {
    return { ok: false, reason: 'no-pending-agent' };
  }
  const runtime = agentRuntime(gameId);
  if (!runtime.config) return { ok: false, reason: 'not-configured' };
  if (runtime.inFlight) return { ok: false, reason: 'already-running' };
  if (runtime.requestsUsed >= runtime.config.maxRequests)
    return { ok: false, reason: 'budget-exhausted' };
  runtime.failure = undefined;
  scheduleAgentTurn(gameId);
  return getAgentStatus(gameId, playerId);
}
