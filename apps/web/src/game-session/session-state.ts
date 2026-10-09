import type { AgentPausedMessage, GameView, LobbyView } from '@regicide/protocol';
import { disconnect, receiveSnapshot, requestAccepted, type LiveState } from './live-sync.ts';

export type Identity = { gameId: string; playerId: string; playerToken: string };
export type LobbyStart =
  | { status: 'ready' }
  | { status: 'pending' }
  | { status: 'accepted' }
  | { status: 'error'; message: string };
export type PlayingOperation = 'idle' | 'submitting' | 'resetting';
export type DevScenario = { name: string; origin: 'solo' | 'co-op' };

type LobbyState = {
  status: 'lobby';
  view: LobbyView;
  start: LobbyStart;
  profileBacked: boolean;
} & Identity;
type PlayingState = {
  status: 'playing';
  view: GameView;
  live: LiveState;
  operation: PlayingOperation;
  actionError: string | null;
  isHost: boolean;
  agentPause: AgentPausedMessage | null;
  devScenario?: DevScenario | undefined;
} & Identity;

export type SessionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | LobbyState
  | PlayingState
  | { status: 'error'; message: string };

type SessionIdentity = Pick<Identity, 'gameId' | 'playerToken'>;

type GlobalSessionEvent =
  | { type: 'return-home' }
  | { type: 'session-load-started' }
  | { type: 'session-load-failed'; message: string }
  | { type: 'lobby-entered'; identity: Identity; view: LobbyView; profileBacked: boolean }
  | { type: 'solo-game-started'; identity: Identity; view: GameView; devScenario?: DevScenario };

type SessionScopedEvent =
  | ({ type: 'lobby-updated'; view: LobbyView } & SessionIdentity)
  | ({ type: 'start-requested' } & SessionIdentity)
  | ({ type: 'start-accepted'; devScenario?: DevScenario } & SessionIdentity)
  | ({ type: 'start-failed'; message: string } & SessionIdentity)
  | ({
      type: 'lobby-game-started';
      view: GameView;
      revision: number;
      devScenario?: DevScenario;
    } & SessionIdentity)
  | ({ type: 'snapshot-observed'; revision: number } & SessionIdentity)
  | ({ type: 'snapshot-received'; revision: number; view: GameView } & SessionIdentity)
  | ({ type: 'agent-paused'; message: AgentPausedMessage } & SessionIdentity)
  | ({ type: 'agent-resumed'; revision: number; playerId: string } & SessionIdentity)
  | ({ type: 'disconnected' } & SessionIdentity)
  | ({
      type: 'operation-started';
      operation: Exclude<PlayingOperation, 'idle'>;
    } & SessionIdentity)
  | ({ type: 'operation-accepted'; submittedAtRevision: number } & SessionIdentity)
  | ({
      type: 'operation-failed';
      submittedAtRevision: number;
      message: string;
    } & SessionIdentity)
  | ({ type: 'operation-finished' } & SessionIdentity);

export type SessionEvent = GlobalSessionEvent | SessionScopedEvent;

export const initialSessionState: SessionState = { status: 'idle' };

export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  if (isSessionScopedEvent(event)) {
    if (
      (state.status !== 'lobby' && state.status !== 'playing') ||
      !matchesCurrentSession(state, event)
    ) {
      return state;
    }
  }

  switch (event.type) {
    // Session lifecycle
    case 'return-home':
      return { status: 'idle' };
    case 'session-load-started':
      return { status: 'loading' };
    case 'session-load-failed':
      return { status: 'error', message: event.message };
    case 'lobby-entered':
      return {
        status: 'lobby',
        ...event.identity,
        view: event.view,
        profileBacked: event.profileBacked,
        start: { status: 'ready' },
      };
    case 'solo-game-started':
      return playing(event.identity, event.view, true, event.devScenario);

    // Lobby
    case 'lobby-updated':
      return state.status === 'lobby' ? { ...state, view: event.view } : state;
    case 'start-requested':
      return state.status === 'lobby' ? { ...state, start: { status: 'pending' } } : state;
    case 'start-accepted':
      if (state.status === 'lobby') {
        return { ...state, start: { status: 'accepted' } };
      }
      return state.status === 'playing' && event.devScenario
        ? { ...state, devScenario: event.devScenario }
        : state;
    case 'start-failed':
      return state.status === 'lobby'
        ? { ...state, start: { status: 'error', message: event.message } }
        : state;
    case 'lobby-game-started':
      return state.status === 'lobby'
        ? {
            ...playing(
              state,
              event.view,
              state.view.hostPlayerId === state.playerId,
              event.devScenario,
            ),
            live: { revision: event.revision, sync: 'ready' },
          }
        : state;

    // Playing
    case 'snapshot-observed': {
      if (state.status !== 'playing') {
        return state;
      }
      const live = receiveSnapshot(state.live, event.revision);
      return live === state.live ? state : { ...state, live };
    }
    case 'snapshot-received':
      if (state.status !== 'playing' || event.revision <= state.live.revision) {
        return state;
      }
      return {
        ...state,
        live: receiveSnapshot(state.live, event.revision),
        view: event.view,
        agentPause: null,
        actionError: null,
      };
    case 'agent-paused': {
      if (state.status !== 'playing' || state.live.revision !== event.message.revision) {
        return state;
      }
      const view = state.view;
      if (
        view.status !== 'active' ||
        view.currentPlayerId !== event.message.playerId ||
        !view.players.some(
          (player) => player.id === event.message.playerId && player.controller === 'agent',
        )
      ) {
        return state;
      }
      return { ...state, agentPause: event.message };
    }
    case 'agent-resumed':
      return state.status === 'playing' &&
        state.agentPause?.revision === event.revision &&
        state.agentPause.playerId === event.playerId &&
        state.live.revision === event.revision
        ? { ...state, agentPause: null }
        : state;
    case 'disconnected': {
      if (state.status !== 'playing') {
        return state;
      }
      const live = disconnect(state.live);
      return live === state.live && state.agentPause === null
        ? state
        : { ...state, live, agentPause: null };
    }
    case 'operation-started':
      return state.status === 'playing'
        ? { ...state, operation: event.operation, actionError: null }
        : state;
    case 'operation-accepted':
      return state.status === 'playing'
        ? { ...state, live: requestAccepted(state.live, event.submittedAtRevision) }
        : state;
    case 'operation-failed':
      return state.status === 'playing' && state.live.revision === event.submittedAtRevision
        ? { ...state, actionError: event.message }
        : state;
    case 'operation-finished':
      return state.status === 'playing' ? { ...state, operation: 'idle' } : state;
  }
}

function playing(
  identity: Identity,
  view: GameView,
  isHost: boolean,
  devScenario?: DevScenario,
): PlayingState {
  // The server starts at revision 0. The first socket snapshot establishes the client revision.
  return {
    status: 'playing',
    gameId: identity.gameId,
    playerId: identity.playerId,
    playerToken: identity.playerToken,
    view,
    live: { revision: -1, sync: 'connecting' },
    operation: 'idle',
    actionError: null,
    isHost,
    agentPause: null,
    ...(devScenario !== undefined ? { devScenario } : {}),
  };
}

function isSessionScopedEvent(event: SessionEvent): event is SessionScopedEvent {
  switch (event.type) {
    case 'return-home':
    case 'session-load-started':
    case 'session-load-failed':
    case 'lobby-entered':
    case 'solo-game-started':
      return false;
    case 'lobby-updated':
    case 'start-requested':
    case 'start-accepted':
    case 'start-failed':
    case 'lobby-game-started':
    case 'snapshot-observed':
    case 'snapshot-received':
    case 'agent-paused':
    case 'agent-resumed':
    case 'disconnected':
    case 'operation-started':
    case 'operation-accepted':
    case 'operation-failed':
    case 'operation-finished':
      return true;
  }
}

function matchesCurrentSession(state: Identity, event: SessionIdentity): boolean {
  return state.gameId === event.gameId && state.playerToken === event.playerToken;
}
