import type { AgentPausedMessage } from '@regicide/protocol';
import type { GameSession, SessionPlayer } from '../../games/game-session.ts';
import { getProfile } from '../../profiles/profile-store.ts';
import type { AgentBlockReason, AgentRuntime } from './agent-runtime.types.ts';

const DEFAULT_AGENT_REQUEST_BUDGET = 50;
const runtimes = new Map<string, AgentRuntime>();

export function getOrCreateAgentRuntime(gameId: string): AgentRuntime {
  let runtime = runtimes.get(gameId);
  if (!runtime) {
    runtime = {
      enabled: true,
      maxRequests: DEFAULT_AGENT_REQUEST_BUDGET,
      requestsUsed: 0,
      generation: 0,
      inFlight: undefined,
      failure: undefined,
      lastPublishedPause: null,
    };
    runtimes.set(gameId, runtime);
  }
  return runtime;
}

export function getAgentRuntime(gameId: string): AgentRuntime | undefined {
  return runtimes.get(gameId);
}

export function resolveAgentReadiness(
  session: GameSession,
  player: Extract<SessionPlayer, { controller: 'agent' }>,
  runtime: AgentRuntime | undefined,
):
  | { ok: true; apiKey: string; model: typeof player.model }
  | { ok: false; reason: AgentBlockReason } {
  if (runtime?.enabled === false) {
    return { ok: false, reason: 'stopped' };
  }
  const profile = session.hostProfileId && getProfile(session.hostProfileId);
  if (!profile) {
    return { ok: false, reason: 'missing-profile' };
  }
  if (!profile.enabledModels.includes(player.model)) {
    return { ok: false, reason: 'model-disabled' };
  }
  if (!profile.openRouterApiKey) {
    return { ok: false, reason: 'missing-key' };
  }
  if ((runtime?.requestsUsed ?? 0) >= (runtime?.maxRequests ?? DEFAULT_AGENT_REQUEST_BUDGET)) {
    return { ok: false, reason: 'budget-exhausted' };
  }
  return { ok: true, apiKey: profile.openRouterApiKey, model: player.model };
}

export function currentAgentPause(
  session: GameSession,
  runtime: AgentRuntime | undefined,
): AgentPausedMessage | null {
  if (session.phase !== 'playing' || session.state.kind !== 'active') {
    return null;
  }
  const playerId = session.state.world.currentPlayer;
  const player = session.players.find((entry) => entry.id === playerId);
  if (player?.controller !== 'agent') {
    return null;
  }

  let reason: AgentPausedMessage['reason'] | null = null;
  if (
    runtime?.failure?.session === session &&
    runtime.failure.revision === session.revision &&
    runtime.failure.playerId === playerId
  ) {
    reason = 'failure';
  } else if (runtime?.inFlight) {
    if (runtime.inFlight.signal.aborted) {
      // Do not resume until the cancelled request has settled.
      const previous = runtime.lastPublishedPause;
      reason =
        previous?.revision === session.revision && previous.playerId === playerId
          ? previous.reason
          : 'stopped';
    }
  } else {
    const readiness = resolveAgentReadiness(session, player, runtime);
    if (!readiness.ok) {
      if (readiness.reason === 'budget-exhausted') {
        reason = 'budget-exhausted';
      } else if (readiness.reason === 'stopped') {
        reason = 'stopped';
      } else {
        reason = 'unconfigured';
      }
    }
  }
  return reason === null
    ? null
    : { type: 'agent-paused', revision: session.revision, playerId, reason };
}

export function isCurrentAgentRuntime(gameId: string, runtime: AgentRuntime): boolean {
  return runtimes.get(gameId) === runtime;
}

export function invalidateAgentExecution(runtime: AgentRuntime): void {
  runtime.generation += 1;
  runtime.inFlight?.abort();
}

export function destroyAgentRuntime(gameId: string): void {
  const runtime = runtimes.get(gameId);
  if (!runtime) {
    return;
  }
  invalidateAgentExecution(runtime);
  runtimes.delete(gameId);
}
