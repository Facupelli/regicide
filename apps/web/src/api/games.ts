import {
  ApiErrorSchema,
  CreateGameResponseSchema,
  GetGameResponseSchema,
  SubmitActionResponseSchema,
  type PlayerCommand,
} from '@regicide/protocol';
import * as v from 'valibot';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

export function createGame() {
  return request('/games', { method: 'POST' }, CreateGameResponseSchema);
}

export function getGame(gameId: string) {
  return request(`/games/${encodeURIComponent(gameId)}`, { method: 'GET' }, GetGameResponseSchema);
}

export function submitAction(gameId: string, command: PlayerCommand) {
  return request(
    `/games/${encodeURIComponent(gameId)}/actions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    },
    SubmitActionResponseSchema,
  );
}

async function request<T extends v.GenericSchema>(
  url: string,
  init: RequestInit,
  schema: T,
): Promise<v.InferOutput<T>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiClientError(0, 'network-error', 'Could not connect to the game server');
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiClientError(response.status, 'invalid-response', 'Invalid API response');
  }

  if (!response.ok) {
    const error = v.safeParse(ApiErrorSchema, body);
    if (error.success) {
      throw new ApiClientError(
        response.status,
        error.output.error.code,
        error.output.error.message,
      );
    }
    throw new ApiClientError(response.status, 'invalid-response', 'Invalid API error response');
  }

  const result = v.safeParse(schema, body);
  if (!result.success) {
    throw new ApiClientError(response.status, 'invalid-response', 'Invalid API response');
  }
  return result.output;
}
