import type { GameState } from '@regicide/game-engine';
import type { ActiveGameView, AgentModelId, PlayerCommand } from '@regicide/protocol';
import type { AgentFailure } from './agents/agent-runtime.ts';

export type InvalidActionDetails = {
  message: string;
  hand: ActiveGameView['viewer']['hand'];
  command: PlayerCommand;
};

type LogEvent =
  | {
      event: 'http.request.failed';
      requestId: string;
      method: string;
      route: string;
      status: number;
    }
  | {
      event: 'agent.decision.failed';
      executionId: string;
      gameId: string;
      agentPlayerId: string;
      model: AgentModelId;
      revision: number;
      decisionKind: Extract<GameState, { kind: 'active' }>['decision']['kind'];
      failureCategory: Exclude<AgentFailure, 'cancelled' | 'internal-error'> | 'UnexpectedError';
      providerStatus?: number;
      elapsedMs: number;
      invalidAction?: InvalidActionDetails;
    }
  | {
      event: 'websocket.connection.failed';
      connectionId: string;
      gameId: string;
      playerId: string;
      stage: 'open' | 'close' | 'socket' | 'send';
    };

export function logFailure(level: 'warn' | 'error', event: LogEvent): void {
  // Serialize only explicitly selected fields, never an entire event or caught error.
  let line: string;
  switch (event.event) {
    case 'http.request.failed':
      line = JSON.stringify({
        level,
        event: 'http.request.failed',
        requestId: event.requestId,
        method: event.method,
        route: event.route,
        status: event.status,
        failureCategory: 'UnexpectedError',
      });
      break;
    case 'agent.decision.failed':
      line = JSON.stringify({
        level,
        event: 'agent.decision.failed',
        executionId: event.executionId,
        gameId: event.gameId,
        agentPlayerId: event.agentPlayerId,
        model: event.model,
        revision: event.revision,
        decisionKind: event.decisionKind,
        failureCategory: event.failureCategory,
        ...(event.providerStatus !== undefined ? { providerStatus: event.providerStatus } : {}),
        elapsedMs: event.elapsedMs,
        ...(event.invalidAction && {
          invalidAction: {
            message: event.invalidAction.message,
            hand: event.invalidAction.hand,
            command: event.invalidAction.command,
          },
        }),
      });
      break;
    case 'websocket.connection.failed':
      line = JSON.stringify({
        level,
        event: 'websocket.connection.failed',
        connectionId: event.connectionId,
        gameId: event.gameId,
        playerId: event.playerId,
        stage: event.stage,
        failureCategory: 'UnexpectedError',
      });
      break;
  }
  if (level === 'warn') console.warn(line);
  else console.error(line);
}
