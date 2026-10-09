import type { PlayerCommand } from '@regicide/protocol';
import type { AgentDecisionSnapshot } from '../decision-snapshot.ts';
import type { StructuredCompletion } from '../openrouter/complete.ts';

export type AgentDecisionInput = Readonly<
  AgentDecisionSnapshot & {
    apiKey: string;
    model: string;
    maxCompletionTokens: number;
    timeoutMs: number;
    signal?: AbortSignal;
  }
>;

export type AgentDecisionResult =
  | Readonly<{
      ok: true;
      command: PlayerCommand;
      usage?: StructuredCompletion<unknown>['usage'];
    }>
  | Readonly<{ ok: false; reason: 'not-acting' }>
  | Readonly<{ ok: false; reason: 'invalid-action'; message: string; command: PlayerCommand }>;
