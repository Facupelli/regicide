import { IllegalActionError, transition, type GameState } from '@regicide/game-engine';
import { scheduleAgentTurn } from '../../agents/agent-turn-runner.ts';
import type { GameEvent, GameView, PlayerCommand } from '@regicide/protocol';
import { gameHub } from '../game-hub.ts';
import type { GameSession } from '../game-session.ts';
import { gameStore } from '../game-store.ts';
import { toGameView } from '../protocol/game-view.ts';
import { toEngineAction } from '../protocol/player-command.ts';
import { deriveAcceptedActionEvents } from './accepted-action-events.ts';

type SubmitCommandResult =
  | { ok: true; view: GameView }
  | {
      ok: false;
      reason: 'game-not-found' | 'game-not-started' | 'player-not-in-game' | 'stale-decision';
    }
  | { ok: false; reason: 'invalid-action'; message: string };

export function submitCommand({
  gameId,
  playerId,
  command,
  expected,
}: {
  gameId: string;
  playerId: string;
  command: PlayerCommand;
  expected?: {
    session: GameSession;
    revision: number;
    playerId: string;
    decisionKind: Extract<GameState, { kind: 'active' }>['decision']['kind'];
  };
}): SubmitCommandResult {
  const session = gameStore.get(gameId);
  if (!session) return { ok: false, reason: 'game-not-found' };
  if (session.phase !== 'playing') return { ok: false, reason: 'game-not-started' };
  if (!session.players.some((player) => player.id === playerId)) {
    return { ok: false, reason: 'player-not-in-game' };
  }
  if (
    expected &&
    (session !== expected.session ||
      session.revision !== expected.revision ||
      playerId !== expected.playerId ||
      session.state.kind !== 'active' ||
      session.state.world.currentPlayer !== playerId ||
      session.state.decision.kind !== expected.decisionKind)
  ) {
    return { ok: false, reason: 'stale-decision' };
  }

  const action = toEngineAction(command, playerId);
  const previousState = session.state;
  let nextState;
  try {
    nextState = transition(previousState, action);
  } catch (error) {
    if (error instanceof IllegalActionError)
      return { ok: false, reason: 'invalid-action', message: error.message };
    throw error;
  }

  // Reserve IDs in event order; commit the counter after all invariants pass.
  const events: GameEvent[] = [];
  for (const event of deriveAcceptedActionEvents(previousState, action, nextState)) {
    events.push({ ...event, id: session.nextEventId + events.length });
  }

  session.nextEventId += events.length;
  session.state = nextState;
  session.revision += 1;
  gameHub.publishGame(gameId, session, events);
  scheduleAgentTurn(gameId);
  return { ok: true, view: toGameView(nextState, playerId, session.players) };
}
