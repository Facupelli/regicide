import type { LobbyView } from '@regicide/protocol';
import type { LobbySession } from '../games/game-session.ts';

export function toLobbyView(session: LobbySession): LobbyView {
  return {
    status: 'lobby',
    hostPlayerId: session.hostPlayerId,
    players: session.players.map((player) => ({ id: player.id })),
  };
}
