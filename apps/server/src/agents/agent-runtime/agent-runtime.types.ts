import type { AgentPausedMessage } from "@regicide/protocol";
import type { GameSession } from "../../games/game-session.ts";

export type AgentFailure =
  | 'authentication'
  | 'insufficient-credits'
  | 'rate-limit'
  | 'provider-error'
  | 'invalid-request'
  | 'timeout'
  | 'cancelled'
  | 'invalid-response'
  | 'invalid-action'
  | 'internal-error';

export type PendingFailure = {
  session: GameSession;
  revision: number;
  playerId: string;
  reason: AgentFailure;
};

export type AgentRuntime = {
  enabled: boolean;
  maxRequests: number;
  requestsUsed: number;
  generation: number;
  inFlight: AbortController | undefined;
  failure: PendingFailure | undefined;
  lastPublishedPause: AgentPausedMessage | null;
};

export type AgentBlockReason =
  | 'stopped'
  | 'missing-profile'
  | 'missing-key'
  | 'model-disabled'
  | 'budget-exhausted';
