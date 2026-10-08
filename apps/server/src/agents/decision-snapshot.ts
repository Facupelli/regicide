import { IllegalActionError, transition, type GameState } from '@regicide/game-engine';
import type { ActiveGameView, PlayerCommand } from '@regicide/protocol';
import { toGameView } from '../games/protocol/game-view.ts';
import { toEngineAction } from '../games/protocol/player-command.ts';

type ActiveState = Extract<GameState, { kind: 'active' }>;

export type AgentDecisionSnapshot = Readonly<{
  observation: ActiveGameView;
  validateCommand: (command: PlayerCommand) => boolean;
}>;

export function createAgentDecisionSnapshot(state: ActiveState): AgentDecisionSnapshot {
  const playerId = state.world.currentPlayer;
  const observation = toGameView(state, playerId);
  if (observation.status !== 'active' || observation.interaction.kind === 'waiting') {
    throw new Error('The current player has no active decision');
  }

  return {
    observation,
    validateCommand(command) {
      try {
        transition(state, toEngineAction(command, playerId));
        return true;
      } catch (error) {
        if (error instanceof IllegalActionError) return false;
        throw error;
      }
    },
  };
}
