import type { GameState } from '@regicide/game-engine';

export type SessionPlayer =
  | { id: string; controller: 'human'; credentialHash: string }
  | { id: string; controller: 'agent' };

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
      nextEventId: number;
      devScenario?: string;
      hostPlayerId: string;
      players: SessionPlayer[];
      state: GameState;
    };
