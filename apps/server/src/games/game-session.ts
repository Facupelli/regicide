import type { GameState } from '@regicide/game-engine';

export type SessionPlayer = { id: string; credentialHash: string };

export type LobbySession = {
  phase: 'lobby';
  hostPlayerId: string;
  players: SessionPlayer[];
};

export type GameSession =
  | LobbySession
  | {
      phase: 'playing';
      revision: number;
      hostPlayerId: string;
      players: SessionPlayer[];
      state: GameState;
    };
