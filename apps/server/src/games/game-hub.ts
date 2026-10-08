import type { WebSocketLike } from '@hono/node-server';
import { GameUpdatedMessageSchema, LobbyUpdatedMessageSchema } from '@regicide/protocol';
import type { GameEvent, LobbyView } from '@regicide/protocol';
import type { WSContext } from 'hono/ws';
import * as v from 'valibot';
import { toGameView } from '../adapters/game-view.ts';
import { toLobbyView } from '../adapters/lobby-view.ts';
import type { GameSession, LobbySession } from './game-session.ts';
import { gameStore } from './game-store.ts';

type PlayingSession = Extract<GameSession, { phase: 'playing' }>;
type GameSnapshot = Pick<PlayingSession, 'state' | 'revision'>;
type GameSocket = WSContext<WebSocketLike>;

class GameHub {
  private readonly connections = new Map<string, Map<string, Set<GameSocket>>>();

  connect(gameId: string, playerId: string, socket: GameSocket): void {
    const session = gameStore.get(gameId);
    if (!session) throw new Error('Cannot connect to a game that does not exist');

    let players = this.connections.get(gameId);
    if (!players) {
      players = new Map();
      this.connections.set(gameId, players);
    }
    let sockets = players.get(playerId);
    if (!sockets) {
      sockets = new Set();
      players.set(playerId, sockets);
    }
    sockets.add(socket);
    if (session.phase === 'lobby') {
      this.sendLobby(gameId, playerId, session, [socket]);
    } else {
      this.sendGame(gameId, playerId, session, [socket], []);
    }
  }

  disconnect(gameId: string, playerId: string, socket: GameSocket): void {
    const players = this.connections.get(gameId);
    const sockets = players?.get(playerId);
    sockets?.delete(socket);
    if (sockets?.size === 0) players?.delete(playerId);
    if (players?.size === 0) this.connections.delete(gameId);
  }

  publishLobby(gameId: string, view: LobbyView): void {
    const players = this.connections.get(gameId);
    if (!players) return;

    const message = JSON.stringify(
      v.parse(LobbyUpdatedMessageSchema, { type: 'lobby-updated', view }),
    );
    for (const [playerId, sockets] of players) {
      this.sendToSockets(gameId, playerId, message, sockets);
    }
  }

  publishGame(gameId: string, snapshot: GameSnapshot, events: readonly GameEvent[] = []): void {
    const players = this.connections.get(gameId);
    if (!players) return;

    for (const [playerId, sockets] of players) {
      this.sendGame(gameId, playerId, snapshot, sockets, events);
    }
  }

  private sendLobby(
    gameId: string,
    playerId: string,
    session: LobbySession,
    sockets: Iterable<GameSocket>,
  ): void {
    const message = JSON.stringify(
      v.parse(LobbyUpdatedMessageSchema, { type: 'lobby-updated', view: toLobbyView(session) }),
    );
    this.sendToSockets(gameId, playerId, message, sockets);
  }

  private sendGame(
    gameId: string,
    playerId: string,
    snapshot: GameSnapshot,
    sockets: Iterable<GameSocket>,
    events: readonly GameEvent[],
  ): void {
    const message = JSON.stringify(
      v.parse(GameUpdatedMessageSchema, {
        type: 'game-updated',
        revision: snapshot.revision,
        view: toGameView(snapshot.state, playerId),
        events,
      }),
    );
    this.sendToSockets(gameId, playerId, message, sockets);
  }

  private sendToSockets(
    gameId: string,
    playerId: string,
    message: string,
    sockets: Iterable<GameSocket>,
  ): void {
    for (const socket of sockets) {
      if (socket.readyState !== 1) {
        this.disconnect(gameId, playerId, socket);
        continue;
      }
      try {
        socket.send(message);
      } catch (error) {
        this.disconnect(gameId, playerId, socket);
        console.error('Failed to send game snapshot', error);
        try {
          socket.close();
        } catch (closeError) {
          console.error('Failed to close WebSocket after send error', closeError);
        }
      }
    }
  }
}

export const gameHub = new GameHub();
