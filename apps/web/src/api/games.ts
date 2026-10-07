import {
  ApiErrorSchema,
  CreateGameResponseSchema,
  JoinGameResponseSchema,
  StartGameResponseSchema,
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

const gamePath = (gameId: string) => `/games/${encodeURIComponent(gameId)}`;

export function createGame() {
  return request('/games', { method: 'POST' }, CreateGameResponseSchema);
}

export function joinGame(gameId: string) {
  return request(`${gamePath(gameId)}/join`, { method: 'POST' }, JoinGameResponseSchema);
}

export function startGame(gameId: string, playerToken: string) {
  return request(
    `${gamePath(gameId)}/start`,
    { method: 'POST', playerToken },
    StartGameResponseSchema,
  );
}

export async function createSoloGame() {
  const lobby = await createGame();
  const started = await startGame(lobby.gameId, lobby.playerToken);
  return { ...started, playerId: lobby.playerId, playerToken: lobby.playerToken };
}

export function submitAction(gameId: string, playerToken: string, command: PlayerCommand) {
  return request(
    `${gamePath(gameId)}/actions`,
    { method: 'POST', playerToken, body: JSON.stringify(command) },
    SubmitActionResponseSchema,
  );
}

async function request<T extends v.GenericSchema>(
  url: string,
  options: { method: 'POST'; playerToken?: string; body?: string },
  schema: T,
): Promise<v.InferOutput<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method,
      headers: {
        ...(options.playerToken ? { Authorization: `Bearer ${options.playerToken}` } : {}),
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(options.body !== undefined ? { body: options.body } : {}),
    });
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
