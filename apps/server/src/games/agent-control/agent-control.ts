import { randomUUID } from 'node:crypto';
import type {
  AgentModelId,
  AgentStatus,
  LobbyView,
  UpdateGameAgentSettingsRequest,
} from '@regicide/protocol';
import {
  agentRuntime,
  invalidateAgentExecution,
  resolveAgentReadiness,
  type AgentBlockReason,
  type AgentRuntime,
} from '../../agents/agent-runtime.ts';
import { scheduleAgentTurn } from '../../agents/agent-turn-runner.ts';
import { getProfile } from '../../profiles/profile-store.ts';
import { gameHub } from '../game-hub.ts';
import type { GameSession } from '../game-session.ts';
import { gameStore } from '../game-store.ts';
import { toLobbyView } from '../protocol/lobby-view.ts';

type HostFailure = { ok: false; reason: 'game-not-found' | 'not-host' };
type OperationFailure =
  | HostFailure
  | {
      ok: false;
      reason: 'game-already-started' | 'lobby-full' | 'profile-required' | 'model-not-enabled';
    };

function hostSession(gameId: string, playerId: string) {
  const session = gameStore.get(gameId);
  if (!session) return { ok: false as const, reason: 'game-not-found' as const };
  if (session.hostPlayerId !== playerId) return { ok: false as const, reason: 'not-host' as const };
  return { ok: true as const, session };
}

export function addAgent(
  gameId: string,
  playerId: string,
  model: AgentModelId,
): { ok: true; view: LobbyView } | OperationFailure {
  const host = hostSession(gameId, playerId);
  if (!host.ok) return host;
  const { session } = host;
  if (session.phase !== 'lobby') return { ok: false, reason: 'game-already-started' };
  if (session.players.length >= 4) return { ok: false, reason: 'lobby-full' };
  if (!session.hostProfileId) return { ok: false, reason: 'profile-required' };
  const profile = getProfile(session.hostProfileId);
  if (!profile) throw new Error('Host profile missing');
  if (!profile.enabledModels.includes(model)) return { ok: false, reason: 'model-not-enabled' };
  session.players.push({ id: randomUUID(), controller: 'agent', model });
  const view = toLobbyView(session);
  gameHub.publishLobby(gameId, view);
  return { ok: true, view };
}

export function removeAgent(
  gameId: string,
  playerId: string,
  agentId: string,
):
  | { ok: true; view: LobbyView }
  | HostFailure
  | { ok: false; reason: 'game-already-started' | 'agent-not-found' | 'not-agent' } {
  const host = hostSession(gameId, playerId);
  if (!host.ok) return host;
  const { session } = host;
  if (session.phase !== 'lobby') return { ok: false, reason: 'game-already-started' };
  const index = session.players.findIndex((player) => player.id === agentId);
  if (index === -1) return { ok: false, reason: 'agent-not-found' };
  if (session.players[index]?.controller !== 'agent') return { ok: false, reason: 'not-agent' };
  session.players.splice(index, 1);
  const view = toLobbyView(session);
  gameHub.publishLobby(gameId, view);
  return { ok: true, view };
}

export function updateAgentSettings(
  gameId: string,
  playerId: string,
  settings: UpdateGameAgentSettingsRequest,
): { ok: true } | HostFailure {
  const host = hostSession(gameId, playerId);
  if (!host.ok) return host;
  const runtime = agentRuntime(gameId);
  if (settings.maxRequests !== undefined) runtime.maxRequests = settings.maxRequests;
  if (settings.enabled !== undefined) {
    if (runtime.enabled && !settings.enabled) invalidateAgentExecution(runtime);
    runtime.enabled = settings.enabled;
  }
  scheduleAgentTurn(gameId);
  return { ok: true };
}

function statusFor(session: GameSession, runtime: AgentRuntime): AgentStatus {
  const base = {
    enabled: runtime.enabled,
    requestsUsed: runtime.requestsUsed,
    maxRequests: runtime.maxRequests,
  };
  if (session.phase !== 'playing' || session.state.kind !== 'active')
    return { ...base, state: 'idle' };
  const playerId = session.state.world.currentPlayer;
  const player = session.players.find((entry) => entry.id === playerId);
  if (player?.controller !== 'agent') return { ...base, state: 'idle' };
  if (
    runtime.failure?.session === session &&
    runtime.failure.revision === session.revision &&
    runtime.failure.playerId === playerId
  ) {
    return { ...base, state: 'failed', reason: runtime.failure.reason };
  }
  if (runtime.inFlight)
    return runtime.inFlight.signal.aborted
      ? { ...base, state: 'blocked', reason: 'stopped' }
      : { ...base, state: 'running' };
  const readiness = resolveAgentReadiness(session, player, runtime);
  return readiness.ok
    ? { ...base, state: 'ready' }
    : { ...base, state: 'blocked', reason: readiness.reason };
}

export function getAgentStatus(
  gameId: string,
  playerId: string,
): { ok: true; status: AgentStatus } | HostFailure {
  const host = hostSession(gameId, playerId);
  if (!host.ok) return host;
  return { ok: true, status: statusFor(host.session, agentRuntime(gameId)) };
}

export function retryAgent(
  gameId: string,
  playerId: string,
):
  | { ok: true; status: AgentStatus }
  | HostFailure
  | {
      ok: false;
      reason: 'no-pending-agent' | 'already-running' | AgentBlockReason;
    } {
  const host = hostSession(gameId, playerId);
  if (!host.ok) return host;
  const { session } = host;
  if (session.phase !== 'playing' || session.state.kind !== 'active')
    return { ok: false, reason: 'no-pending-agent' };
  const player = session.players.find((entry) => entry.id === session.state.world.currentPlayer);
  if (player?.controller !== 'agent') return { ok: false, reason: 'no-pending-agent' };
  const runtime = agentRuntime(gameId);
  if (runtime.inFlight) return { ok: false, reason: 'already-running' };
  const readiness = resolveAgentReadiness(session, player, runtime);
  if (!readiness.ok) return readiness;
  runtime.failure = undefined;
  scheduleAgentTurn(gameId);
  return { ok: true, status: statusFor(session, runtime) };
}
