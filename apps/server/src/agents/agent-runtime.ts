import type { GameSession } from '../games/game-session.ts';

export type AgentConfig = Readonly<{
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxCompletionTokens: number;
  maxRequests: number;
}>;

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
  config: AgentConfig | undefined;
  requestsUsed: number;
  generation: number;
  inFlight: AbortController | undefined;
  failure: PendingFailure | undefined;
};

const runtimes = new Map<string, AgentRuntime>();

export function agentRuntime(gameId: string): AgentRuntime {
  let runtime = runtimes.get(gameId);
  if (!runtime) {
    runtime = {
      config: undefined,
      requestsUsed: 0,
      generation: 0,
      inFlight: undefined,
      failure: undefined,
    };
    runtimes.set(gameId, runtime);
  }
  return runtime;
}

export function currentAgentRuntime(gameId: string, runtime: AgentRuntime): boolean {
  return runtimes.get(gameId) === runtime;
}

export function invalidateAgentConfig(runtime: AgentRuntime): void {
  runtime.generation += 1;
  runtime.inFlight?.abort();
}

export function destroyAgentRuntime(gameId: string): void {
  const runtime = runtimes.get(gameId);
  if (!runtime) return;
  invalidateAgentConfig(runtime);
  runtime.config = undefined;
  runtimes.delete(gameId);
}
