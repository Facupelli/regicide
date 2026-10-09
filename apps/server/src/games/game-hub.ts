import type { WebSocketLike } from '@hono/node-server';
import {
  AgentPausedMessageSchema,
  AgentResumedMessageSchema,
  GameUpdatedMessageSchema,
  LobbyUpdatedMessageSchema,
} from '@regicide/protocol';
import type { GameEvent, LobbyView } from '@regicide/protocol';
import type { WSContext } from 'hono/ws';
import * as v from 'valibot';
import { agentRuntime, currentAgentPause, existingAgentRuntime } from '../agents/agent-runtime.ts';
import { toGameView } from './protocol/game-view.ts';
import { toLobbyView } from './protocol/lobby-view.ts';
import type { GameSession, LobbySession } from './game-session.ts';
import { gameStore } from './game-store.ts';

type PlayingSession = Extract<GameSession, { phase: 'playing' }>;
type GameSnapshot = Pick<PlayingSession, 'state' | 'revision' | 'players'>;
type GameSocket = WSContext<WebSocketLike>;

class GameHub {
  private readonly connections = new Map<string, Map<string, Set<GameSocket>>>();
  private readonly reportSendFailure = new WeakMap<GameSocket, () => void>();

  connect(gameId: string, playerId: string, socket: GameSocket, onSendFailure: () => void): void {
    this.reportSendFailure.set(socket, onSendFailure);
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
      const pause = currentAgentPause(session, existingAgentRuntime(gameId));
      if (pause) {
        this.sendToSockets(
          gameId,
          playerId,
          JSON.stringify(v.parse(AgentPausedMessageSchema, pause)),
          [socket],
        );
      }
    }
  }

  disconnect(gameId: string, playerId: string, socket: GameSocket): void {
    this.reportSendFailure.delete(socket);
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

  publishAgentState(gameId: string): void {
    const session = gameStore.get(gameId);
    if (!session) return;
    const pause = currentAgentPause(session, existingAgentRuntime(gameId));
    const runtime = existingAgentRuntime(gameId) ?? (pause ? agentRuntime(gameId) : undefined);
    if (!runtime) return;
    const previous = runtime.lastPublishedPause;
    if (
      previous?.revision === pause?.revision &&
      previous?.playerId === pause?.playerId &&
      previous?.reason === pause?.reason
    ) {
      return;
    }
    runtime.lastPublishedPause = pause;

    const players = this.connections.get(gameId);
    if (!players) return;
    let message: string;
    if (pause) {
      message = JSON.stringify(v.parse(AgentPausedMessageSchema, pause));
    } else if (
      previous &&
      session.phase === 'playing' &&
      session.revision === previous.revision &&
      session.state.kind === 'active' &&
      session.state.world.currentPlayer === previous.playerId
    ) {
      message = JSON.stringify(
        v.parse(AgentResumedMessageSchema, {
          type: 'agent-resumed',
          revision: previous.revision,
          playerId: previous.playerId,
        }),
      );
    } else {
      return;
    }
    for (const [playerId, sockets] of players) {
      this.sendToSockets(gameId, playerId, message, sockets);
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
        view: toGameView(snapshot.state, playerId, snapshot.players),
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
      } catch {
        const reportFailure = this.reportSendFailure.get(socket);
        this.disconnect(gameId, playerId, socket);
        reportFailure?.();
        try {
          socket.close();
        } catch {
          // The send failure is already logged. Closing is best-effort.
        }
      }
    }
  }
}

export const gameHub = new GameHub();
