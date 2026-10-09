import { ApiErrorSchema } from '@regicide/protocol';
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

type RequestOptions = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  bearerToken?: string;
  body?: string;
};

export async function request<T extends v.GenericSchema>(
  url: string,
  options: RequestOptions,
  schema: T,
): Promise<v.InferOutput<T>> {
  const response = await fetchApi(url, options);
  const body = await readJson(response);
  if (!response.ok) {
    throw apiFailure(response, body);
  }
  const result = v.safeParse(schema, body);
  if (!result.success) {
    throw new ApiClientError(response.status, 'invalid-response', 'Invalid API response');
  }
  return result.output;
}

export async function requestNoContent(url: string, options: RequestOptions): Promise<void> {
  const response = await fetchApi(url, options);
  if (response.status === 204) {
    return;
  }
  throw apiFailure(response, await readJson(response));
}

async function fetchApi(url: string, options: RequestOptions): Promise<Response> {
  try {
    return await fetch(url, {
      method: options.method,
      headers: {
        ...(options.bearerToken ? { Authorization: `Bearer ${options.bearerToken}` } : {}),
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(options.body !== undefined ? { body: options.body } : {}),
    });
  } catch {
    throw new ApiClientError(0, 'network-error', 'Could not connect to the server');
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiClientError(response.status, 'invalid-response', 'Invalid API response');
  }
}

function apiFailure(response: Response, body: unknown): ApiClientError {
  const error = v.safeParse(ApiErrorSchema, body);
  return error.success
    ? new ApiClientError(response.status, error.output.error.code, error.output.error.message)
    : new ApiClientError(response.status, 'invalid-response', 'Invalid API error response');
}
