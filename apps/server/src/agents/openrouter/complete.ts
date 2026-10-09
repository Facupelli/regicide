import { toJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';

type ErrorCode =
  | 'authentication'
  | 'insufficient-credits'
  | 'rate-limit'
  | 'provider-error'
  | 'invalid-request'
  | 'timeout'
  | 'cancelled'
  | 'invalid-response';

const errorMessages: Record<ErrorCode, string> = {
  authentication: 'OpenRouter authentication failed',
  'insufficient-credits': 'OpenRouter account has insufficient credits',
  'rate-limit': 'OpenRouter rate limit exceeded',
  'provider-error': 'OpenRouter request failed',
  'invalid-request': 'OpenRouter request is invalid',
  timeout: 'OpenRouter request timed out',
  cancelled: 'OpenRouter request was cancelled',
  'invalid-response': 'OpenRouter returned an invalid or incomplete response',
};

export class OpenRouterError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly providerStatus?: number,
  ) {
    super(errorMessages[code]);
    this.name = 'OpenRouterError';
  }
}

const TokenCountSchema = v.pipe(v.number(), v.integer(), v.minValue(0));
const CompletionSchema = v.object({
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

export type StructuredCompletion<TOutput> = {
  output: TOutput;
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
};

export type CompleteOptions<TSchema extends v.StrictObjectSchema<v.ObjectEntries, undefined>> = {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  schemaName: string;
  responseSchema: TSchema;
  maxCompletionTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
};

function statusError(status: number): OpenRouterError {
  if (status === 401 || status === 403) return new OpenRouterError('authentication', status);
  if (status === 402) return new OpenRouterError('insufficient-credits', status);
  if (status === 429) return new OpenRouterError('rate-limit', status);
  if (status === 408 || status === 504) return new OpenRouterError('timeout', status);
  if (status === 400 || status === 404 || status === 422)
    return new OpenRouterError('invalid-request', status);
  return new OpenRouterError('provider-error', status);
}

export async function completeStructured<
  const TSchema extends v.StrictObjectSchema<v.ObjectEntries, undefined>,
>({
  apiKey,
  model,
  system,
  user,
  schemaName,
  responseSchema,
  maxCompletionTokens,
  timeoutMs,
  signal,
}: CompleteOptions<TSchema>): Promise<StructuredCompletion<v.InferOutput<TSchema>>> {
  if (
    !apiKey ||
    !model ||
    !schemaName ||
    !Number.isSafeInteger(maxCompletionTokens) ||
    maxCompletionTokens <= 0 ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > 2_147_483_647
  ) {
    throw new OpenRouterError('invalid-request');
  }

  // Conversion must succeed before a billable request; unsupported Valibot features are rejected.
  let schema: ReturnType<typeof toJsonSchema>;
  try {
    const { $schema: _dialect, ...converted } = toJsonSchema(responseSchema, {
      target: 'draft-07',
      errorMode: 'throw',
    });
    schema = converted;
  } catch {
    throw new OpenRouterError('invalid-request');
  }
  if (schema.type !== 'object' || schema.additionalProperties !== false) {
    throw new OpenRouterError('invalid-request');
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const abortError = () =>
    new OpenRouterError(
      signal?.aborted && requestSignal.reason === signal.reason ? 'cancelled' : 'timeout',
    );

  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        stream: false,
        // DeepSeek V3.2's structured-output providers support max_tokens, not
        // max_completion_tokens. Keep the latter for GPT-5 Mini providers.
        ...(model === 'deepseek/deepseek-v3.2'
          ? { max_tokens: maxCompletionTokens }
          : { max_completion_tokens: maxCompletionTokens }),
        response_format: {
          type: 'json_schema',
          json_schema: { name: schemaName, strict: true, schema },
        },
        provider: { require_parameters: true, allow_fallbacks: false },
      }),
      signal: requestSignal,
    });
  } catch {
    if (requestSignal.aborted) throw abortError();
    throw new OpenRouterError('provider-error');
  }

  if (requestSignal.aborted) throw abortError();
  if (!response.ok) throw statusError(response.status);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (requestSignal.aborted) throw abortError();
    throw new OpenRouterError('invalid-response');
  }
  if (requestSignal.aborted) throw abortError();

  const parsed = v.safeParse(CompletionSchema, body);
  if (!parsed.success || parsed.output.choices.length !== 1) {
    throw new OpenRouterError('invalid-response');
  }
  const choice = parsed.output.choices[0];
  if (!choice || choice.finish_reason !== 'stop' || choice.message.refusal) {
    throw new OpenRouterError('invalid-response');
  }

  let output: unknown;
  try {
    output = JSON.parse(choice.message.content);
  } catch {
    throw new OpenRouterError('invalid-response');
  }
  const validated = v.safeParse(responseSchema, output);
  if (!validated.success) {
    throw new OpenRouterError('invalid-response');
  }

  const usage = parsed.output.usage;
  return {
    output: validated.output,
    ...(usage && {
      usage: {
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
    }),
  };
}
