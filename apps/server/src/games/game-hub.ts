import type { WebSocketLike } from '@hono/node-server';
import { GameUpdatedMessageSchema } from '@regicide/protocol';
import type { WSContext } from 'hono/ws';
import * as v from 'valibot';
import { toGameView } from '../adapters/game-view.ts';
import type { GameSession } from './game-session.ts';
import { gameStore } from './game-store.ts';

type PlayingSession = Extract<GameSession, { phase: 'playing' }>;
type GameSocket = WSContext<WebSocketLike>;

class GameHub {
  private readonly connections = new Map<string, Map<string, Set<GameSocket>>>();

  connect(gameId: string, playerId: string, socket: GameSocket): void {
    const session = gameStore.get(gameId);
    if (session?.phase !== 'playing')
      throw new Error('Cannot connect to a game that is not playing');

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
    this.sendSnapshot(gameId, playerId, session, [socket]);
  }

  disconnect(gameId: string, playerId: string, socket: GameSocket): void {
    const players = this.connections.get(gameId);
    const sockets = players?.get(playerId);
    sockets?.delete(socket);
    if (sockets?.size === 0) players?.delete(playerId);
    if (players?.size === 0) this.connections.delete(gameId);
  }

  publishGame(gameId: string): void {
    const players = this.connections.get(gameId);
    if (!players) return;
    const session = gameStore.get(gameId);
    if (session?.phase !== 'playing') throw new Error('Cannot publish a game that is not playing');

    for (const [playerId, sockets] of players) {
      this.sendSnapshot(gameId, playerId, session, sockets);
    }
  }

  private sendSnapshot(
    gameId: string,
    playerId: string,
    session: PlayingSession,
    sockets: Iterable<GameSocket>,
  ): void {
    const message = JSON.stringify(
      v.parse(GameUpdatedMessageSchema, {
        type: 'game-updated',
        revision: session.revision,
        view: toGameView(session.state, playerId),
      }),
    );
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
