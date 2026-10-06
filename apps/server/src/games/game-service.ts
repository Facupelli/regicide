import { transition } from '@regicide/game-engine';
import type { PlayerCommand, GameView } from '@regicide/protocol';
import { toGameView } from '../adapters/game-view.ts';
import { toEngineAction } from '../adapters/player-command.ts';
import { gameStore } from './game-store.ts';

type SubmitCommandResult =
  | { ok: true; view: GameView }
  | { ok: false; reason: 'game-not-found' }
  | { ok: false; reason: 'invalid-action'; message: string };

export const gameService = {
  submitCommand({
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

    const action = toEngineAction(command, playerId);
    let nextState;
    try {
      nextState = transition(session.state, action);
    } catch (error) {
      if (error instanceof Error)
        return { ok: false, reason: 'invalid-action', message: error.message };
      throw error;
    }

    session.state = nextState;
    return { ok: true, view: toGameView(nextState, playerId) };
  },
};
