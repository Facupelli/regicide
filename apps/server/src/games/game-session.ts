import type { GameState } from '@regicide/game-engine';

export type SessionPlayer = { id: string };

export type LobbySession = {
  phase: 'lobby';
  hostPlayerId: string;
  players: SessionPlayer[];
};

export type GameSession =
  | LobbySession
  | {
      phase: 'playing';
      hostPlayerId: string;
      players: SessionPlayer[];
      state: GameState;
    };
