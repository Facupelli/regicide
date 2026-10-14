import type { GameState } from '@regicide/game-engine';
import type { AgentModelId } from '@regicide/protocol';

export type SessionPlayer =
  | { id: string; controller: 'human'; credentialHash: string }
  | { id: string; controller: 'agent'; model: AgentModelId };

export type LobbySession = {
  phase: 'lobby';
  hostPlayerId: string;
  hostProfileId?: string;
  players: SessionPlayer[];
};

export type GameSession =
  | LobbySession
  | {
      phase: 'playing';
      revision: number;
      nextEventId: number;
      hostPlayerId: string;
      hostProfileId?: string;
      players: SessionPlayer[];
      state: GameState;
    };
