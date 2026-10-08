import { randomUUID } from 'node:crypto';
import type { LobbyView } from '@regicide/protocol';
import { gameStore } from '../game-store.ts';
import { createSessionPlayer } from '../player-auth.ts';
import { toLobbyView } from '../protocol/lobby-view.ts';

export function createGame(): {
  gameId: string;
  playerId: string;
  playerToken: string;
  view: LobbyView;
} {
  const gameId = randomUUID();
  const { player, playerToken } = createSessionPlayer();
  const session = {
    phase: 'lobby' as const,
    hostPlayerId: player.id,
    players: [player],
  };
  gameStore.set(gameId, session);
  return { gameId, playerId: player.id, playerToken, view: toLobbyView(session) };
}
