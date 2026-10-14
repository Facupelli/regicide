import type { GameEvent } from '@regicide/protocol';
import { notifyAgentGameChanged } from '../agents/agent-coordinator.ts';
import { logFailure } from '../diagnostics.ts';
import { gameHub } from './game-hub.ts';
import type { GameSession } from './game-session.ts';

type PlayingSession = Extract<GameSession, { phase: 'playing' }>;

export function publishCommittedGame(
  gameId: string,
  session: PlayingSession,
  events: readonly GameEvent[] = [],
): void {
  try {
    gameHub.publishGame(gameId, session, events);
  } catch (error) {
    logFailure('error', {
      event: 'game.notification.failed',
      gameId,
      revision: session.revision,
      channel: 'websocket',
      error,
    });
  }

  try {
    notifyAgentGameChanged(gameId);
  } catch (error) {
    logFailure('error', {
      event: 'game.notification.failed',
      gameId,
      revision: session.revision,
      channel: 'agent-wake',
      error,
    });
  }
}
