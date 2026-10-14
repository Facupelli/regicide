import type { GameState } from '@regicide/game-engine';
import type { ActiveGameView } from '@regicide/protocol';
import type { SessionPlayer } from '../games/game-session.ts';
import { toGameView } from '../games/protocol/game-view.ts';

type ActiveState = Extract<GameState, { kind: 'active' }>;

export type AgentDecisionSnapshot = Readonly<{
  observation: ActiveGameView;
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

  return { observation };
}
