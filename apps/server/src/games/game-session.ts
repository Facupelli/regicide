import type { GameState } from '@regicide/game-engine';
import type { AgentModelId } from '@regicide/protocol';

export type SessionPlayer =
  | { id: string; name: string; controller: 'human'; credentialHash: string }
  | { id: string; name: string; controller: 'agent'; model: AgentModelId };

export function isNameTaken(players: readonly SessionPlayer[], name: string): boolean {
  return players.some((player) => player.name.toLowerCase() === name.toLowerCase());
}

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
