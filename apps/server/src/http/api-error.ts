import type { ApiError } from '@regicide/protocol';

export function apiError(code: string, message: string): ApiError {
  return { error: { code, message } };
}
