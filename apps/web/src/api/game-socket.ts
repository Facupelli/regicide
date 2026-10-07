import {
  GameUpdatedMessageSchema,
  LobbyUpdatedMessageSchema,
  type GameUpdatedMessage,
  type LobbyUpdatedMessage,
} from '@regicide/protocol';
import * as v from 'valibot';

type GameSocketOptions = {
  gameId: string;
  playerToken: string;
  onLobbyUpdated: (message: LobbyUpdatedMessage) => void;
  onGameUpdated: (message: GameUpdatedMessage) => void;
  onDisconnected: () => void;
};

export function connectGameSocket({
  gameId,
  playerToken,
  onLobbyUpdated,
  onGameUpdated,
  onDisconnected,
}: GameSocketOptions): () => void {
  const url = new URL(`/games/${encodeURIComponent(gameId)}/ws`, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('playerToken', playerToken);

  let stopped = false;
  let socket: WebSocket;
  let retry: ReturnType<typeof setTimeout> | undefined;

  function connect() {
    if (stopped) return;
    const connection = new WebSocket(url);
    socket = connection;
    connection.onmessage = (event) => {
      if (stopped) return;
      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch {
        connection.close();
        return;
      }
      const lobby = v.safeParse(LobbyUpdatedMessageSchema, data);
      if (lobby.success) {
        onLobbyUpdated(lobby.output);
        return;
      }
      const game = v.safeParse(GameUpdatedMessageSchema, data);
      if (game.success) {
        onGameUpdated(game.output);
        return;
      }
      connection.close();
    };
    connection.onclose = () => {
      if (stopped) return;
      onDisconnected();
      retry = setTimeout(connect, 1500);
    };
  }

  connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    socket.close();
  };
}
