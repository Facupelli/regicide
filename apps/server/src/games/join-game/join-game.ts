import type { LobbyView } from '@regicide/protocol';
import { gameHub } from '../game-hub.ts';
import { gameStore } from '../game-store.ts';
import { isNameTaken } from '../game-session.ts';
import { createSessionPlayer } from '../player-auth.ts';
import { toLobbyView } from '../protocol/lobby-view.ts';

const MAX_PLAYERS = 4;

type JoinGameResult =
  | { ok: true; playerId: string; playerToken: string; view: LobbyView }
  | { ok: false; reason: 'game-not-found' | 'game-already-started' | 'lobby-full' | 'name-taken' };

export function joinGame({ gameId, name }: { gameId: string; name: string }): JoinGameResult {
  const session = gameStore.get(gameId);
  if (!session) {
    return { ok: false, reason: 'game-not-found' };
  }
  if (session.phase !== 'lobby') {
    return { ok: false, reason: 'game-already-started' };
  }
  if (session.players.length >= MAX_PLAYERS) {
    return { ok: false, reason: 'lobby-full' };
  }

  if (isNameTaken(session.players, name)) {
    return { ok: false, reason: 'name-taken' };
  }

  const { player, playerToken } = createSessionPlayer(name);
  session.players.push(player);
  const view = toLobbyView(session);
  gameHub.publishLobby(gameId, view);
  return { ok: true, playerId: player.id, playerToken, view };
}
