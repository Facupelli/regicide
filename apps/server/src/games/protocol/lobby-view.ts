import type { LobbyView } from '@regicide/protocol';
import type { LobbySession } from '../game-session.ts';

export function toLobbyView(session: LobbySession): LobbyView {
  return {
    status: 'lobby',
    hostPlayerId: session.hostPlayerId,
    players: session.players.map((player) =>
      player.controller === 'agent'
        ? { id: player.id, name: player.name, controller: 'agent', model: player.model }
        : { id: player.id, name: player.name, controller: 'human' },
    ),
  };
}
