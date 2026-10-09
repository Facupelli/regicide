import type { GameView, LobbyView } from '@regicide/protocol';
import { gameStore } from '../game-store.ts';
import { authenticateSessionPlayer } from '../player-auth.ts';
import { toGameView } from '../protocol/game-view.ts';
import { toLobbyView } from '../protocol/lobby-view.ts';

type GetGameResult =
  | { ok: true; view: LobbyView | GameView }
  | { ok: false; reason: 'game-not-found' | 'invalid-credential' };

export function getGame({
  gameId,
  playerToken,
}: {
  gameId: string;
  playerToken: string | undefined;
}): GetGameResult {
  const session = gameStore.get(gameId);
  if (!session) {
    return { ok: false, reason: 'game-not-found' };
  }
  if (session.phase === 'lobby') {
    return { ok: true, view: toLobbyView(session) };
  }
  const playerId = playerToken && authenticateSessionPlayer(session, playerToken);
  if (!playerId) {
    return { ok: false, reason: 'invalid-credential' };
  }
  return { ok: true, view: toGameView(session.state, playerId, session.players) };
}
