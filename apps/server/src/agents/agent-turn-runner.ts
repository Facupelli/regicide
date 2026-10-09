import { randomUUID } from 'node:crypto';
import { logFailure, type InvalidActionDetails } from '../diagnostics.ts';
import { decideAgentAction } from './decide-agent-action.ts';
import { createAgentDecisionSnapshot } from './decision-snapshot.ts';
import { OpenRouterError } from './openrouter/complete.ts';
import {
  agentRuntime,
  currentAgentRuntime,
  resolveAgentReadiness,
  type AgentFailure,
  type AgentRuntime,
} from './agent-runtime.ts';
import type { GameSession } from '../games/game-session.ts';
import { gameHub } from '../games/game-hub.ts';
import { gameStore } from '../games/game-store.ts';
import { submitCommand } from '../games/submit-action/submit-command.ts';

const AGENT_TIMEOUT_MS = 90_000;
const AGENT_MAX_COMPLETION_TOKENS = 4_096;

export function scheduleAgentTurn(gameId: string): void {
  const session = gameStore.get(gameId);
  if (session?.phase !== 'playing' || session.state.kind !== 'active') {
    gameHub.publishAgentState(gameId);
    return;
  }
  const state = session.state;
  const playerId = state.world.currentPlayer;
  const player = session.players.find((entry) => entry.id === playerId);
  if (player?.controller !== 'agent') {
    gameHub.publishAgentState(gameId);
    return;
  }

  const runtime = agentRuntime(gameId);
  if (runtime.inFlight) {
    gameHub.publishAgentState(gameId);
    return;
  }
  if (runtime.failure) {
    if (
      runtime.failure.session === session &&
      runtime.failure.revision === session.revision &&
      runtime.failure.playerId === playerId
    ) {
      gameHub.publishAgentState(gameId);
      return;
    }
    runtime.failure = undefined;
  }
  const readiness = resolveAgentReadiness(session, player, runtime);
  if (!readiness.ok) {
    gameHub.publishAgentState(gameId);
    return;
  }

  const executionId = randomUUID();
  const startedAt = performance.now();
  const controller = new AbortController();
  runtime.inFlight = controller;
  gameHub.publishAgentState(gameId);
  const generation = runtime.generation;
  const revision = session.revision;
  const decisionKind = state.decision.kind;
  let failureRecorded = false;
  const failDecision = (
    reason: AgentFailure,
    providerStatus?: number,
    invalidAction?: InvalidActionDetails,
  ): void => {
    failureRecorded = true;
    fail(runtime, session, revision, playerId, reason);
    if (reason === 'cancelled') return;
    logFailure(reason === 'invalid-action' ? 'warn' : 'error', {
      event: 'agent.decision.failed',
      executionId,
      gameId,
      agentPlayerId: playerId,
      model: readiness.model,
      revision,
      decisionKind,
      failureCategory: reason === 'internal-error' ? 'UnexpectedError' : reason,
      ...(providerStatus !== undefined ? { providerStatus } : {}),
      ...(invalidAction ? { invalidAction } : {}),
      elapsedMs: Math.round(performance.now() - startedAt),
    });
  };

  void (async () => {
    try {
      const snapshot = createAgentDecisionSnapshot(state, session.players);
      runtime.requestsUsed += 1;
      const result = await decideAgentAction({
        ...snapshot,
        model: readiness.model,
        apiKey: readiness.apiKey,
        timeoutMs: AGENT_TIMEOUT_MS,
        maxCompletionTokens: AGENT_MAX_COMPLETION_TOKENS,
        signal: controller.signal,
      });
      if (!currentAgentRuntime(gameId, runtime) || runtime.generation !== generation) {
        return;
      }
      if (!result.ok) {
        if (result.reason === 'invalid-action') {
          failDecision('invalid-action', undefined, {
            message: result.message,
            hand: snapshot.observation.viewer.hand,
            command: result.command,
          });
        } else {
          failDecision('internal-error');
        }
        return;
      }
      const submitted = submitCommand({
        gameId,
        playerId,
        command: result.command,
        expected: { session, revision, playerId, decisionKind },
      });
      if (!submitted.ok && submitted.reason !== 'stale-decision') {
        failDecision('internal-error');
      }
    } catch (error) {
      if (currentAgentRuntime(gameId, runtime) && runtime.generation === generation) {
        failDecision(
          error instanceof OpenRouterError ? error.code : 'internal-error',
          error instanceof OpenRouterError ? error.providerStatus : undefined,
        );
      }
    } finally {
      if (runtime.inFlight === controller) runtime.inFlight = undefined;
      if (currentAgentRuntime(gameId, runtime)) {
        try {
          scheduleAgentTurn(gameId);
        } catch {
          if (!failureRecorded) {
            logFailure('error', {
              event: 'agent.decision.failed',
              executionId,
              gameId,
              agentPlayerId: playerId,
              model: readiness.model,
              revision,
              decisionKind,
              failureCategory: 'UnexpectedError',
              elapsedMs: Math.round(performance.now() - startedAt),
            });
          }
        }
      }
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
