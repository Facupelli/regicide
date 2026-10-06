import type { GameState } from '@regicide/game-engine';

export type GameSession = {
  playerId: string;
  state: GameState;
};
