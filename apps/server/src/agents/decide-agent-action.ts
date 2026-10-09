import type { PlayerCommand } from '@regicide/protocol';
import * as v from 'valibot';
import type { AgentDecisionSnapshot } from './decision-snapshot.ts';
import { completeStructured, type StructuredCompletion } from './openrouter/complete.ts';
import { REGICIDE_AGENT_PROMPT } from './regicide-prompt.ts';

const TurnDecisionSchema = v.strictObject({
  command: v.union([
    v.strictObject({ kind: v.picklist(['play-cards']), cardIds: v.array(v.string()) }),
    v.strictObject({ kind: v.picklist(['yield']) }),
    v.strictObject({ kind: v.picklist(['use-solo-jester']) }),
  ]),
});
const RetaliationDecisionSchema = v.strictObject({
  command: v.union([
    v.strictObject({ kind: v.picklist(['discard-for-damage']), cardIds: v.array(v.string()) }),
    v.strictObject({ kind: v.picklist(['use-solo-jester']) }),
    v.strictObject({ kind: v.picklist(['accept-defeat']) }),
  ]),
});
const NextPlayerDecisionSchema = v.strictObject({
  command: v.strictObject({
    kind: v.picklist(['choose-next-player']),
    targetPlayerId: v.string(),
  }),
});

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

export async function decideAgentAction(input: AgentDecisionInput): Promise<AgentDecisionResult> {
  const { observation } = input;
  if (
    observation.currentPlayerId !== observation.viewer.id ||
    observation.interaction.kind === 'waiting'
  ) {
    return { ok: false, reason: 'not-acting' };
  }

  let responseSchema:
    | typeof TurnDecisionSchema
    | typeof RetaliationDecisionSchema
    | typeof NextPlayerDecisionSchema;
  switch (observation.interaction.kind) {
    case 'turn':
      responseSchema = TurnDecisionSchema;
      break;
    case 'damage-discard':
      responseSchema = RetaliationDecisionSchema;
      break;
    case 'choose-next-player':
      responseSchema = NextPlayerDecisionSchema;
      break;
  }

  const completion = await completeStructured({
    apiKey: input.apiKey,
    model: input.model,
    system: REGICIDE_AGENT_PROMPT,
    user: JSON.stringify({ observation }),
    schemaName: 'regicide_agent_command',
    responseSchema,
    maxCompletionTokens: input.maxCompletionTokens,
    timeoutMs: input.timeoutMs,
    ...(input.signal && { signal: input.signal }),
  });

  const command = completion.output.command;
  const validation = input.validateCommand(command);
  if (!validation.valid) {
    return { ok: false, reason: 'invalid-action', message: validation.message, command };
  }

  return {
    ok: true,
    command,
    ...(completion.usage && { usage: completion.usage }),
  };
}
