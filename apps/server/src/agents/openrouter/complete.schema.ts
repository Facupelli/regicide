import * as v from 'valibot';

const TokenCountSchema = v.pipe(v.number(), v.integer(), v.minValue(0));

export const CompletionSchema = v.object({
  choices: v.array(
    v.object({
      finish_reason: v.string(),
      message: v.object({
        role: v.literal('assistant'),
        content: v.string(),
        refusal: v.optional(v.nullable(v.string())),
      }),
    }),
  ),
  usage: v.optional(
    v.nullable(
      v.object({
        prompt_tokens: TokenCountSchema,
        completion_tokens: TokenCountSchema,
        total_tokens: TokenCountSchema,
      }),
    ),
  ),
});
