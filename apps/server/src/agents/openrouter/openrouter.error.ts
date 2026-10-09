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

export function statusError(status: number): OpenRouterError {
  if (status === 401 || status === 403) {
    return new OpenRouterError('authentication', status);
  }
  if (status === 402) {
    return new OpenRouterError('insufficient-credits', status);
  }
  if (status === 429) {
    return new OpenRouterError('rate-limit', status);
  }
  if (status === 408 || status === 504) {
    return new OpenRouterError('timeout', status);
  }
  if (status === 400 || status === 404 || status === 422) {
    return new OpenRouterError('invalid-request', status);
  }
  return new OpenRouterError('provider-error', status);
}
