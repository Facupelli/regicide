import type { GameState } from '@regicide/game-engine';
import type { ActiveGameView, AgentModelId, PlayerCommand } from '@regicide/protocol';
import type { AgentFailure } from './agents/agent-runtime/agent-runtime.types.ts';

export type InvalidActionDetails = {
  message: string;
  hand: ActiveGameView['viewer']['hand'];
  command: PlayerCommand;
};

type LogEvent =
  | {
      event: 'http.request.failed';
      requestId: string;
      method: string;
      route: string;
      status: number;
    }
  | {
      event: 'agent.decision.failed';
      executionId: string;
      gameId: string;
      agentPlayerId: string;
      model: AgentModelId;
      revision: number;
      decisionKind: Extract<GameState, { kind: 'active' }>['decision']['kind'];
      failureCategory: Exclude<AgentFailure, 'cancelled' | 'internal-error'> | 'UnexpectedError';
      providerStatus?: number;
      elapsedMs: number;
      state?: GameState;
      invalidAction?: InvalidActionDetails;
      error?: unknown;
    }
  | {
      event: 'game.notification.failed';
      gameId: string;
      revision: number;
      channel: 'websocket' | 'agent-wake';
      error: unknown;
    }
  | {
      event: 'websocket.connection.failed';
      connectionId: string;
      gameId: string;
      playerId: string;
      stage: 'open' | 'close' | 'socket' | 'send';
    };

// Keep diagnostic context, but never serialize the exception object or recognizable credentials.
function redactNotificationSecrets(text: string): string {
  return text
    .replace(
      /\b(Authorization\s*[:=]\s*)(?:(Bearer|Basic)\s+)?[^\s"',;]+/gi,
      (_match, field: string, scheme: string | undefined) =>
        `${field}${scheme ? `${scheme} ` : ''}[REDACTED]`,
    )
    .replace(/\b(Bearer|Basic)(\s+)[^\s"',;]+/gi, '$1$2[REDACTED]')
    .replace(
      /(\b(?:api[-_ ]?key|openRouterApiKey|openrouter[_-]?api[_-]?key|playerToken|profileToken|token|credential(?:Hash)?|password|secret)\b["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}\]]+)/gi,
      '$1[REDACTED]',
    )
    .replace(/\bsk-[\w-]+/gi, '[REDACTED]');
}

export function diagnosticErrorDetails(
  error: unknown,
  includeStack = true,
): {
  errorName: string;
  errorMessage?: string;
  errorStack?: string;
} {
  if (!(error instanceof Error)) {
    return {
      errorName: typeof error,
      ...(typeof error === 'string' ? { errorMessage: redactNotificationSecrets(error) } : {}),
    };
  }

  try {
    const errorName = /^[A-Za-z_$][A-Za-z0-9_$]{0,79}$/.test(error.name) ? error.name : 'Error';
    const message = error.message;
    // The first stack line repeats the message. Keep only call-site frames.
    const frames = error.stack?.split('\n').slice(1).join('\n');
    return {
      errorName,
      ...(message ? { errorMessage: redactNotificationSecrets(message) } : {}),
      ...(includeStack && frames ? { errorStack: redactNotificationSecrets(frames) } : {}),
    };
  } catch {
    // An exception's properties can themselves throw. Logging remains best-effort.
    return { errorName: 'Error' };
  }
}

export function isAiDebugEnabled(): boolean {
  return process.env.AI_DEBUG === 'true';
}

export type AgentDiagnostic = {
  event:
    | 'agent.coordinator.wake'
    | 'agent.coordinator.recovery'
    | 'agent.decision.started'
    | 'agent.decision.proposed'
    | 'agent.decision.validation'
    | 'agent.decision.discarded'
    | 'agent.decision.cancelled'
    | 'agent.provider.request'
    | 'agent.provider.response'
    | 'agent.provider.error';
  gameId: string;
  executionId?: string;
  revision?: number;
  [detail: string]: unknown;
};

const credentialField =
  /^(?:authorization|proxy-authorization|api[_-]?key|openrouterapi[_-]?key|player[_-]?token|profile[_-]?token|token|credential(?:hash)?|password|secret)$/i;

function sanitizeDiagnostic(
  value: unknown,
  secret?: string,
  seen = new WeakSet<object>(),
): unknown {
  if (typeof value === 'string') {
    return redactNotificationSecrets(secret ? value.replaceAll(secret, '[REDACTED]') : value);
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);
    const result = value.map((entry) => sanitizeDiagnostic(entry, secret, seen));
    seen.delete(value);
    return result;
  }
  if (value && typeof value === 'object') {
    if ('type' in value && value.type === 'reasoning.encrypted') {
      return '[OMITTED: encrypted reasoning]';
    }
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'reasoning.encrypted' || key === 'encrypted') {
        continue;
      }
      result[key] = credentialField.test(key)
        ? '[REDACTED]'
        : sanitizeDiagnostic(entry, secret, seen);
    }
    seen.delete(value);
    return result;
  }
  return value;
}

// Parse provider JSON so opaque reasoning is removed before writing verbose logs.
// If malformed JSON contains an encrypted field, omit the raw body rather than risk leaking it.
function safeProviderBody(rawBody: unknown): unknown {
  if (typeof rawBody !== 'string') {
    return rawBody;
  }
  try {
    return JSON.parse(rawBody);
  } catch {
    return /reasoning[._-]encrypted|["']encrypted["']\s*:/i.test(rawBody)
      ? '[OMITTED: malformed response contains encrypted reasoning]'
      : rawBody;
  }
}

function compactAgentDiagnostic(event: AgentDiagnostic): Record<string, unknown> | null {
  const base = {
    level: 'info',
    event: event.event,
    gameId: event.gameId,
    ...(event.executionId !== undefined ? { executionId: event.executionId } : {}),
    ...(event.revision !== undefined ? { revision: event.revision } : {}),
  };
  switch (event.event) {
    case 'agent.coordinator.wake':
    case 'agent.provider.request':
    case 'agent.provider.response':
      return null;
    case 'agent.coordinator.recovery':
      return {
        ...base,
        operation: event.operation,
        enabled: event.enabled,
        playerId: event.playerId,
        requestsUsed: event.requestsUsed,
        maxRequests: event.maxRequests,
      };
    case 'agent.decision.started':
      return {
        ...base,
        playerId: event.playerId,
        decisionKind: event.decisionKind,
        model: event.model,
      };
    case 'agent.decision.proposed':
      return {
        ...base,
        playerId: event.playerId,
        decisionKind: event.decisionKind,
        command: event.command,
        elapsedMs: event.elapsedMs,
        usage: event.usage,
      };
    case 'agent.decision.validation':
      return {
        ...base,
        playerId: event.playerId,
        outcome: event.outcome,
        engineRejection: event.engineRejection,
        currentRevision: event.currentRevision,
        elapsedMs: event.elapsedMs,
      };
    case 'agent.decision.discarded':
      return {
        ...base,
        playerId: event.playerId,
        reason: event.reason,
        elapsedMs: event.elapsedMs,
      };
    case 'agent.decision.cancelled':
      return {
        ...base,
        playerId: event.playerId,
        reason: event.reason,
        currentRevision: event.currentRevision,
      };
    case 'agent.provider.error':
      return { ...base, reason: event.reason };
    default:
      return null;
  }
}

// Diagnostics must never affect game transitions or AI execution. Large details are
// only built when verbose logging is enabled.
export function logAgentDiagnostic(
  event: AgentDiagnostic,
  secret?: string,
  verboseDetails?: () => Record<string, unknown>,
): void {
  try {
    const debug = isAiDebugEnabled();
    const output: Record<string, unknown> | null = debug
      ? { level: 'info', ...event, ...verboseDetails?.() }
      : compactAgentDiagnostic(event);
    if (!output) {
      return;
    }
    if (debug && event.event === 'agent.provider.response' && 'rawBody' in output) {
      output.rawBody = safeProviderBody(output.rawBody);
    }
    console.info(JSON.stringify(sanitizeDiagnostic(output, secret)));
  } catch {
    // Best-effort logging.
  }
}

export function logFailure(level: 'warn' | 'error', event: LogEvent, secret?: string): void {
  try {
    writeFailure(level, event, secret);
  } catch {
    // Best-effort logging.
  }
}

function writeFailure(level: 'warn' | 'error', event: LogEvent, secret?: string): void {
  const debug = isAiDebugEnabled();
  let entry: Record<string, unknown>;
  switch (event.event) {
    case 'http.request.failed':
      entry = {
        level,
        event: 'http.request.failed',
        requestId: event.requestId,
        method: event.method,
        route: event.route,
        status: event.status,
        failureCategory: 'UnexpectedError',
      };
      break;
    case 'agent.decision.failed':
      entry = {
        level,
        event: 'agent.decision.failed',
        executionId: event.executionId,
        gameId: event.gameId,
        agentPlayerId: event.agentPlayerId,
        model: event.model,
        revision: event.revision,
        decisionKind: event.decisionKind,
        failureCategory: event.failureCategory,
        ...(event.providerStatus !== undefined ? { providerStatus: event.providerStatus } : {}),
        elapsedMs: event.elapsedMs,
        ...(debug && event.state && { state: event.state }),
        ...(event.error !== undefined && {
          error: diagnosticErrorDetails(event.error, debug),
        }),
        ...(event.invalidAction && {
          invalidAction: {
            message: event.invalidAction.message,
            command: event.invalidAction.command,
            ...(debug && { hand: event.invalidAction.hand }),
          },
        }),
      };
      break;
    case 'game.notification.failed':
      entry = {
        level,
        event: 'game.notification.failed',
        gameId: event.gameId,
        revision: event.revision,
        channel: event.channel,
        ...diagnosticErrorDetails(event.error, debug),
        failureCategory: 'UnexpectedError',
      };
      break;
    case 'websocket.connection.failed':
      entry = {
        level,
        event: 'websocket.connection.failed',
        connectionId: event.connectionId,
        gameId: event.gameId,
        playerId: event.playerId,
        stage: event.stage,
        failureCategory: 'UnexpectedError',
      };
      break;
  }
  if (level === 'warn') {
    console.warn(JSON.stringify(sanitizeDiagnostic(entry, secret)));
  } else {
    console.error(JSON.stringify(sanitizeDiagnostic(entry, secret)));
  }
}
