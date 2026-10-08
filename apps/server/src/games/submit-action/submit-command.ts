import { IllegalActionError, transition } from '@regicide/game-engine';
import type { GameEvent, GameView, PlayerCommand } from '@regicide/protocol';
import { gameHub } from '../game-hub.ts';
import { gameStore } from '../game-store.ts';
import { toGameView } from '../protocol/game-view.ts';
import { toEngineAction } from '../protocol/player-command.ts';
import { deriveAcceptedActionEvents } from './accepted-action-events.ts';

type SubmitCommandResult =
  | { ok: true; view: GameView }
  | { ok: false; reason: 'game-not-found' | 'game-not-started' | 'player-not-in-game' }
  | { ok: false; reason: 'invalid-action'; message: string };

export function submitCommand({
  gameId,
  playerId,
  command,
}: {
  gameId: string;
  playerId: string;
  command: PlayerCommand;
}): SubmitCommandResult {
  const session = gameStore.get(gameId);
  if (!session) return { ok: false, reason: 'game-not-found' };
  if (session.phase !== 'playing') return { ok: false, reason: 'game-not-started' };
  if (!session.players.some((player) => player.id === playerId)) {
    return { ok: false, reason: 'player-not-in-game' };
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
  gameHub.publishGame(gameId, { state: nextState, revision: session.revision }, events);
  return { ok: true, view: toGameView(nextState, playerId) };
}
