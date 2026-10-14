import type { ActiveGameView } from '@regicide/protocol';
import { completeStructured } from '../openrouter/complete.ts';
import { REGICIDE_AGENT_PROMPT } from '../regicide-prompt.ts';
import {
  NextPlayerDecisionSchema,
  RetaliationDecisionSchema,
  TurnDecisionSchema,
} from './decide-agent-command.schema.ts';
import type { AgentDecisionInput, AgentDecisionResult } from './decide-agent-command.types.ts';

export async function decideAgentCommand(input: AgentDecisionInput): Promise<AgentDecisionResult> {
  const { observation } = input;
  if (
    observation.currentPlayerId !== observation.viewer.id ||
    observation.interaction.kind === 'waiting'
  ) {
    return { ok: false, reason: 'not-acting' };
  }

  const responseSchema = getResponseSchema(observation);

  const completion = await completeStructured({
    apiKey: input.apiKey,
    model: input.model,
    system: REGICIDE_AGENT_PROMPT,
    user: JSON.stringify({ observation }),
    schemaName: 'regicide_agent_command',
    responseSchema,
    maxCompletionTokens: input.maxCompletionTokens,
    timeoutMs: input.timeoutMs,
    diagnostic: input.diagnostic,
    ...(input.signal && { signal: input.signal }),
  });

  return {
    ok: true,
    command: completion.output.command,
    ...(completion.usage && { usage: completion.usage }),
  };
}

function getResponseSchema(
  observation: ActiveGameView,
): typeof TurnDecisionSchema | typeof RetaliationDecisionSchema | typeof NextPlayerDecisionSchema {
  switch (observation.interaction.kind) {
    case 'turn':
      return TurnDecisionSchema;
    case 'damage-discard':
      return RetaliationDecisionSchema;
    case 'choose-next-player':
      return NextPlayerDecisionSchema;
    default:
      throw new Error('Unsupported interaction kind');
  }
}
