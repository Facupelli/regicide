import { decideAgentAction } from './decide-agent-action.ts';
import { createAgentDecisionSnapshot } from './decision-snapshot.ts';
import { OpenRouterError } from './openrouter/complete.ts';
import {
  agentRuntime,
  currentAgentRuntime,
  type AgentFailure,
  type AgentRuntime,
} from './agent-runtime.ts';
import type { GameSession } from '../games/game-session.ts';
import { gameStore } from '../games/game-store.ts';
import { submitCommand } from '../games/submit-action/submit-command.ts';

export function scheduleAgentTurn(gameId: string): void {
  const session = gameStore.get(gameId);
  if (session?.phase !== 'playing' || session.state.kind !== 'active') return;
  const state = session.state;
  const playerId = state.world.currentPlayer;
  if (!session.players.some((player) => player.id === playerId && player.controller === 'agent')) {
    return;
  }

  const runtime = agentRuntime(gameId);
  if (runtime.inFlight || !runtime.config) return;
  if (runtime.failure) {
    if (
      runtime.failure.session === session &&
      runtime.failure.revision === session.revision &&
      runtime.failure.playerId === playerId
    ) {
      return;
    }
    runtime.failure = undefined;
  }
  if (runtime.requestsUsed >= runtime.config.maxRequests) {
    return;
  }

  const controller = new AbortController();
  runtime.inFlight = controller;
  const generation = runtime.generation;
  const revision = session.revision;
  const decisionKind = state.decision.kind;
  const config = runtime.config;

  void (async () => {
    try {
      const snapshot = createAgentDecisionSnapshot(state);
      runtime.requestsUsed += 1;
      const result = await decideAgentAction({ ...snapshot, ...config, signal: controller.signal });
      if (!currentAgentRuntime(gameId, runtime) || runtime.generation !== generation) {
        return;
      }
      if (!result.ok) {
        fail(
          runtime,
          session,
          revision,
          playerId,
          result.reason === 'invalid-action' ? 'invalid-action' : 'internal-error',
        );
        return;
      }
      const submitted = submitCommand({
        gameId,
        playerId,
        command: result.command,
        expected: { session, revision, playerId, decisionKind },
      });
      if (!submitted.ok && submitted.reason !== 'stale-decision') {
        fail(runtime, session, revision, playerId, 'internal-error');
      }
    } catch (error) {
      if (currentAgentRuntime(gameId, runtime) && runtime.generation === generation) {
        fail(
          runtime,
          session,
          revision,
          playerId,
          error instanceof OpenRouterError ? error.code : 'internal-error',
        );
      }
    } finally {
      if (runtime.inFlight === controller) runtime.inFlight = undefined;
      if (currentAgentRuntime(gameId, runtime)) scheduleAgentTurn(gameId);
    }
  })();
}

function fail(
  runtime: AgentRuntime,
  session: GameSession,
  revision: number,
  playerId: string,
  reason: AgentFailure,
): void {
  runtime.failure = { session, revision, playerId, reason };
}
