import { toJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import { isAiDebugEnabled, logAgentDiagnostic } from '../../diagnostics.ts';
import { CompletionSchema } from './complete.schema.ts';
import { OpenRouterError, statusError } from './openrouter.error.ts';

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
  diagnostic?: { executionId: string; gameId: string; revision: number };
};

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
  diagnostic,
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

  const request = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    stream: false,
    // All supported models have structured-output endpoints accepting max_tokens.
    max_tokens: maxCompletionTokens,
    response_format: {
      type: 'json_schema',
      json_schema: { name: schemaName, strict: true, schema },
    },
    provider: { require_parameters: true, allow_fallbacks: false },
  };
  const record = (
    event: 'agent.provider.request' | 'agent.provider.response' | 'agent.provider.error',
    details: Record<string, unknown>,
  ) => {
    if (diagnostic) {
      logAgentDiagnostic({ event, ...diagnostic, ...details }, apiKey);
    }
  };
  record('agent.provider.request', { request, timeoutMs });

  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: requestSignal,
    });
  } catch {
    const error = requestSignal.aborted ? abortError() : new OpenRouterError('provider-error');
    record('agent.provider.error', { reason: error.code });
    throw error;
  }

  record('agent.provider.response', { providerStatus: response.status });
  if (requestSignal.aborted) {
    throw abortError();
  }
  if (!response.ok) {
    // Read error content only for diagnostics. Do not delay or change status classification.
    if (diagnostic && isAiDebugEnabled()) {
      try {
        void response.text().then(
          (rawBody) =>
            record('agent.provider.response', { providerStatus: response.status, rawBody }),
          () => {},
        );
      } catch {
        // A diagnostic read must not affect the provider error.
      }
    }
    throw statusError(response.status);
  }

  let body: unknown;
  try {
    const rawBody = await response.text();
    record('agent.provider.response', { providerStatus: response.status, rawBody });
    body = JSON.parse(rawBody);
  } catch {
    if (requestSignal.aborted) {
      throw abortError();
    }
    throw new OpenRouterError('invalid-response');
  }
  if (requestSignal.aborted) {
    throw abortError();
  }

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
  record('agent.provider.response', {
    providerStatus: response.status,
    output: validated.output,
    ...(usage && { usage }),
  });
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
