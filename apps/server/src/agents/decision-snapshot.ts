import { IllegalActionError, transition, type GameState } from '@regicide/game-engine';
import type { ActiveGameView, PlayerCommand } from '@regicide/protocol';
import type { SessionPlayer } from '../games/game-session.ts';
import { toGameView } from '../games/protocol/game-view.ts';
import { toEngineAction } from '../games/protocol/player-command.ts';

type ActiveState = Extract<GameState, { kind: 'active' }>;

export type AgentDecisionSnapshot = Readonly<{
  observation: ActiveGameView;
  validateCommand: (command: PlayerCommand) => { valid: true } | { valid: false; message: string };
}>;

export function createAgentDecisionSnapshot(
  state: ActiveState,
  sessionPlayers: readonly SessionPlayer[],
): AgentDecisionSnapshot {
  const playerId = state.world.currentPlayer;
  const observation = toGameView(state, playerId, sessionPlayers);
  if (observation.status !== 'active' || observation.interaction.kind === 'waiting') {
    throw new Error('The current player has no active decision');
  }

  return {
    observation,
    validateCommand(command) {
      try {
        transition(state, toEngineAction(command, playerId));
        return { valid: true };
      } catch (error) {
        if (error instanceof IllegalActionError) {
          return { valid: false, message: error.message };
        }
        throw error;
      }
    },
  };
}
