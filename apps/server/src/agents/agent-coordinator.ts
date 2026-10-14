import { randomUUID } from 'node:crypto';
import {
  logAgentDiagnostic,
  logFailure,
  type AgentDiagnostic,
  type InvalidActionDetails,
} from '../diagnostics.ts';
import { gameHub } from '../games/game-hub.ts';
import type { GameSession } from '../games/game-session.ts';
import { gameStore } from '../games/game-store.ts';
import { submitCommand } from '../games/submit-action/submit-command.ts';
import {
  getAgentRuntime,
  getOrCreateAgentRuntime,
  invalidateAgentExecution,
  isCurrentAgentRuntime,
  resolveAgentReadiness,
} from './agent-runtime/agent-runtime.ts';
import type { AgentFailure, AgentRuntime } from './agent-runtime/agent-runtime.types.ts';
import { decideAgentCommand } from './decide-agent-command/decide-agent-command.ts';
import { createAgentDecisionSnapshot } from './decision-snapshot.ts';
import { OpenRouterError } from './openrouter/openrouter.error.ts';

const AGENT_TIMEOUT_MS = 90_000;
const AGENT_MAX_COMPLETION_TOKENS = 4_096;

function wake(gameId: string, outcome: string, details: Record<string, unknown> = {}): void {
  const session = gameStore.get(gameId);
  logAgentDiagnostic({
    event: 'agent.coordinator.wake',
    gameId,
    ...(session?.phase === 'playing' ? { revision: session.revision } : {}),
    outcome,
    ...details,
  });
}

// A stopped agent or a replaced scenario must not apply the old inference result.
// Keep the flight slot until that request settles; the next notification is coalesced.
export function cancelAgentExecution(gameId: string, reason: 'stopped' | 'scenario-reset'): void {
  const runtime = getAgentRuntime(gameId);
  if (!runtime) {
    return;
  }
  if (reason === 'scenario-reset' && !runtime.inFlight) {
    return;
  }
  if (runtime.inFlight) {
    const session = gameStore.get(gameId);
    const revision = session?.phase === 'playing' ? session.revision : undefined;
    logAgentDiagnostic({
      event: 'agent.decision.cancelled',
      gameId,
      ...(revision !== undefined
        ? { revision: reason === 'scenario-reset' ? revision - 1 : revision }
        : {}),
      ...(revision !== undefined && reason === 'scenario-reset'
        ? { currentRevision: revision }
        : {}),
      reason,
    });
  }
  invalidateAgentExecution(runtime);
}

// A notification is only a signal to inspect authoritative state. While an invocation
// owns the flight slot, all notifications collapse into one pending inspection.
export function notifyAgentGameChanged(gameId: string): void {
  if (!gameStore.has(gameId)) {
    wake(gameId, 'no-active-decision');
    return;
  }
  const runtime = getOrCreateAgentRuntime(gameId);
  runtime.pendingWake = true;
  if (runtime.inFlight) {
    wake(gameId, 'in-flight');
    gameHub.publishAgentState(gameId);
    return;
  }
  inspectPendingDecision(gameId, runtime);
}

function inspectPendingDecision(gameId: string, runtime: AgentRuntime): void {
  if (!runtime.pendingWake || runtime.inFlight || !isCurrentAgentRuntime(gameId, runtime)) {
    return;
  }
  runtime.pendingWake = false;
  const session = gameStore.get(gameId);
  if (session?.phase !== 'playing' || session.state.kind !== 'active') {
    wake(gameId, 'no-active-decision');
    gameHub.publishAgentState(gameId);
    return;
  }
  const state = session.state;
  const playerId = state.world.currentPlayer;
  const player = session.players.find((entry) => entry.id === playerId);
  if (player?.controller !== 'agent') {
    wake(gameId, 'not-agent', { playerId });
    gameHub.publishAgentState(gameId);
    return;
  }
  if (runtime.failure) {
    if (
      runtime.failure.session === session &&
      runtime.failure.revision === session.revision &&
      runtime.failure.playerId === playerId
    ) {
      wake(gameId, 'failed', { playerId, reason: runtime.failure.reason });
      gameHub.publishAgentState(gameId);
      return;
    }
    runtime.failure = undefined;
  }
  const readiness = resolveAgentReadiness(session, player, runtime);
  if (!readiness.ok) {
    wake(gameId, 'blocked', { playerId, reason: readiness.reason });
    gameHub.publishAgentState(gameId);
    return;
  }

  const controller = new AbortController();
  const executionId = randomUUID();
  const startedAt = performance.now();
  const generation = runtime.generation;
  const revision = session.revision;
  const decisionKind = state.decision.kind;
  runtime.inFlight = controller;
  controller.signal.addEventListener(
    'abort',
    () => {
      const current = gameStore.get(gameId);
      logAgentDiagnostic(
        {
          event: 'agent.decision.cancelled',
          executionId,
          gameId,
          revision,
          playerId,
          decisionKind,
          currentRevision: current?.phase === 'playing' ? current.revision : undefined,
        },
        readiness.apiKey,
      );
    },
    { once: true },
  );
  wake(gameId, 'started', { executionId, playerId, decisionKind });
  // A failed status publication must not strand the reserved flight slot.
  try {
    gameHub.publishAgentState(gameId);
  } catch (error) {
    logFailure('error', {
      event: 'game.notification.failed',
      gameId,
      revision,
      channel: 'websocket',
      error,
    });
  }
  void agentTurn({
    gameId,
    runtime,
    session,
    state,
    playerId,
    controller,
    generation,
    revision,
    decisionKind,
    executionId,
    startedAt,
    apiKey: readiness.apiKey,
    model: readiness.model,
  });
}

type Turn = {
  gameId: string;
  runtime: AgentRuntime;
  session: Extract<GameSession, { phase: 'playing' }>;
  state: Extract<Extract<GameSession, { phase: 'playing' }>['state'], { kind: 'active' }>;
  playerId: string;
  controller: AbortController;
  generation: number;
  revision: number;
  decisionKind: Extract<
    Extract<GameSession, { phase: 'playing' }>['state'],
    { kind: 'active' }
  >['decision']['kind'];
  executionId: string;
  startedAt: number;
  apiKey: string;
  model: Extract<GameSession['players'][number], { controller: 'agent' }>['model'];
};

// One invocation, one proposed command. Only a received notification can request
// another inspection after this invocation settles.
async function agentTurn(turn: Turn): Promise<void> {
  const {
    gameId,
    runtime,
    session,
    state,
    playerId,
    controller,
    generation,
    revision,
    decisionKind,
    executionId,
    startedAt,
    apiKey,
    model,
  } = turn;
  const trace = (
    event: AgentDiagnostic['event'],
    details: Record<string, unknown> = {},
    verboseDetails?: () => Record<string, unknown>,
  ): void =>
    logAgentDiagnostic(
      { event, executionId, gameId, revision, playerId, decisionKind, ...details },
      apiKey,
      verboseDetails,
    );
  const isCurrentDecision = (): boolean => {
    const current = gameStore.get(gameId);
    return (
      isCurrentAgentRuntime(gameId, runtime) &&
      runtime.generation === generation &&
      runtime.enabled &&
      runtime.inFlight === controller &&
      !controller.signal.aborted &&
      current === session &&
      current.phase === 'playing' &&
      current.revision === revision &&
      current.state.kind === 'active' &&
      current.state.world.currentPlayer === playerId &&
      current.state.decision.kind === decisionKind &&
      current.players.some((entry) => entry.id === playerId && entry.controller === 'agent')
    );
  };
  const failDecision = (
    reason: AgentFailure,
    providerStatus?: number,
    invalidAction?: InvalidActionDetails,
    error?: unknown,
  ): void => {
    runtime.failure = { session, revision, playerId, reason };
    if (reason === 'cancelled') {
      return;
    }
    logFailure(
      reason === 'invalid-action' ? 'warn' : 'error',
      {
        event: 'agent.decision.failed',
        executionId,
        gameId,
        agentPlayerId: playerId,
        model,
        revision,
        decisionKind,
        failureCategory: reason === 'internal-error' ? 'UnexpectedError' : reason,
        ...(providerStatus !== undefined ? { providerStatus } : {}),
        ...(invalidAction ? { invalidAction } : {}),
        ...(error !== undefined ? { error } : {}),
        elapsedMs: Math.round(performance.now() - startedAt),
        state,
      },
      apiKey,
    );
  };

  try {
    const snapshot = createAgentDecisionSnapshot(state, session.players);
    trace(
      'agent.decision.started',
      { model, requestsUsed: runtime.requestsUsed, maxRequests: runtime.maxRequests },
      () => ({
        state,
        players: session.players.map((entry) => ({ id: entry.id, controller: entry.controller })),
        observation: snapshot.observation,
      }),
    );
    runtime.requestsUsed += 1;
    const result = await decideAgentCommand({
      ...snapshot,
      model,
      apiKey,
      timeoutMs: AGENT_TIMEOUT_MS,
      maxCompletionTokens: AGENT_MAX_COMPLETION_TOKENS,
      diagnostic: { executionId, gameId, revision },
      signal: controller.signal,
    });
    if (!isCurrentDecision()) {
      trace('agent.decision.discarded', {
        reason: 'stale-proposal',
        elapsedMs: Math.round(performance.now() - startedAt),
      });
      return;
    }
    if (!result.ok) {
      trace('agent.decision.validation', {
        outcome: result.reason,
        elapsedMs: Math.round(performance.now() - startedAt),
      });
      failDecision('internal-error');
      return;
    }

    trace('agent.decision.proposed', {
      command: result.command,
      usage: result.usage,
      elapsedMs: Math.round(performance.now() - startedAt),
    });
    const submitted = submitCommand({
      gameId,
      playerId,
      command: result.command,
      expected: { session, revision, playerId, decisionKind },
    });
    const current = gameStore.get(gameId);
    trace('agent.decision.validation', {
      command: result.command,
      outcome: submitted.ok ? 'accepted' : submitted.reason,
      ...(!submitted.ok && submitted.reason === 'invalid-action'
        ? { engineRejection: submitted.message }
        : {}),
      currentRevision: current?.phase === 'playing' ? current.revision : undefined,
      elapsedMs: Math.round(performance.now() - startedAt),
    });
    if (!submitted.ok) {
      if (submitted.reason === 'invalid-action') {
        failDecision('invalid-action', undefined, {
          message: submitted.message,
          hand: snapshot.observation.viewer.hand,
          command: result.command,
        });
      } else if (submitted.reason !== 'stale-decision') {
        failDecision('internal-error');
      }
    }
  } catch (error) {
    if (isCurrentDecision()) {
      failDecision(
        error instanceof OpenRouterError ? error.code : 'internal-error',
        error instanceof OpenRouterError ? error.providerStatus : undefined,
        undefined,
        error,
      );
    } else {
      trace('agent.decision.discarded', {
        reason: 'stale-error',
        elapsedMs: Math.round(performance.now() - startedAt),
      });
    }
  } finally {
    if (runtime.inFlight === controller) {
      runtime.inFlight = undefined;
    }
    if (isCurrentAgentRuntime(gameId, runtime)) {
      try {
        if (runtime.pendingWake) {
          inspectPendingDecision(gameId, runtime);
        } else {
          gameHub.publishAgentState(gameId);
        }
      } catch (error) {
        logFailure('error', {
          event: 'game.notification.failed',
          gameId,
          revision,
          channel: 'agent-wake',
          error,
        });
      }
    }
  }
}
