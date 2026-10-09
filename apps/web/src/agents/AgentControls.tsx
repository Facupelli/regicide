import { useState, type FormEvent } from 'react';
import type {
  AgentPausedMessage,
  AgentStatus,
  UpdateGameAgentSettingsRequest,
} from '@regicide/protocol';
import { ApiClientError } from '../api-client.ts';
import { Button } from '../ui/Button.tsx';

const failureMessages: Record<Extract<AgentStatus, { state: 'failed' }>['reason'], string> = {
  authentication: 'OpenRouter rejected the profile key.',
  'insufficient-credits': 'The OpenRouter account has insufficient credits.',
  'rate-limit': 'OpenRouter is rate limiting requests. Retry when it is available.',
  'provider-error': 'The model provider could not complete the request.',
  'invalid-request': 'The model provider rejected the request.',
  timeout: 'The model request timed out.',
  cancelled: 'The model request was cancelled.',
  'invalid-response': 'The model returned an invalid or incomplete response.',
  'invalid-action': 'The proposed game action was not legal.',
  'internal-error': 'An internal error prevented the AI decision.',
};

export function AgentControls({
  status,
  agentPause,
  statusError,
  onRefresh,
  onUpdate,
  onRetry,
  onOpenAiSettings,
}: {
  status: AgentStatus | null;
  agentPause: AgentPausedMessage | null;
  statusError: string | null;
  onRefresh: () => void;
  onUpdate: (settings: UpdateGameAgentSettingsRequest) => Promise<void>;
  onRetry: () => Promise<void>;
  onOpenAiSettings: () => void;
}) {
  const [budgetDraft, setBudgetDraft] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canRetry =
    status?.enabled &&
    status.requestsUsed < status.maxRequests &&
    (status.state === 'failed' ||
      (status.state === 'blocked' &&
        (status.reason === 'missing-profile' ||
          status.reason === 'missing-key' ||
          status.reason === 'model-disabled')) ||
      (status.state === 'ready' && agentPause !== null && agentPause.reason !== 'stopped'));
  const maxRequests = budgetDraft ?? status?.maxRequests ?? 50;

  async function run(action: () => Promise<void>, success: string) {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? `${cause.message} (${cause.code})`
          : 'Could not update AI execution settings.',
      );
    } finally {
      setPending(false);
    }
  }

  function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 500) {
      setError('Enter a request budget from 1 to 500.');
      return;
    }
    void run(async () => {
      await onUpdate({ maxRequests });
      setBudgetDraft(null);
    }, 'Request budget updated.');
  }

  return (
    <section
      className="rounded-lg border border-border bg-panel p-4 text-sm text-foreground"
      aria-label="AI execution controls"
    >
      <h2 className="text-lg font-semibold">AI teammates</h2>
      <p className="mt-1 text-muted-foreground">
        {status?.state === 'ready' && agentPause && agentPause.reason !== 'stopped'
          ? 'Ready to retry the paused AI decision.'
          : getAgentStatusMessage(status)}
      </p>
      {status && (
        <p className="mt-1 text-muted-foreground">
          Requests used: {status.requestsUsed} / {status.maxRequests} (shared by all AI teammates).
        </p>
      )}
      {statusError && (
        <p role="alert" className="mt-2 text-danger">
          {statusError}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button disabled={pending} onClick={onRefresh}>
          Refresh status
        </Button>
        <Button disabled={pending} onClick={onOpenAiSettings}>
          AI Settings
        </Button>
      </div>
      {canRetry && (
        <Button
          className="mt-3"
          disabled={pending}
          onClick={() => void run(onRetry, 'Retry requested.')}
        >
          Retry decision
        </Button>
      )}
      <form onSubmit={saveBudget} className="mt-4 grid gap-3 border-t border-border pt-4">
        <label className="grid gap-1" htmlFor="agent-budget">
          Maximum requests (game total)
          <input
            id="agent-budget"
            type="number"
            min={1}
            max={500}
            step={1}
            required
            value={maxRequests}
            onChange={(event) => setBudgetDraft(Number(event.target.value))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          />
        </label>
        <p className="text-muted-foreground">
          This limits request count, not exact cost. Updating the limit does not reset usage.
          Credentials and available models are managed by the host profile.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            Save budget
          </Button>
          {status && (
            <Button
              type="button"
              className={status.enabled ? 'bg-transparent text-danger' : undefined}
              disabled={pending}
              onClick={() =>
                void run(
                  () => onUpdate({ enabled: !status.enabled }),
                  status.enabled ? 'AI stopped for this game.' : 'AI enabled for this game.',
                )
              }
            >
              {status.enabled ? 'Stop AI' : 'Resume AI'}
            </Button>
          )}
        </div>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-muted-foreground">
          {notice}
        </p>
      )}
    </section>
  );
}

function getAgentStatusMessage(status: AgentStatus | null): string {
  if (status === null) {
    return 'Loading AI status...';
  }
  if (status.state === 'failed') {
    return `Decision paused: ${failureMessages[status.reason]}`;
  }
  if (status.state === 'blocked') {
    switch (status.reason) {
      case 'stopped':
        return 'AI execution is stopped for this game.';
      case 'budget-exhausted':
        return 'Request budget exhausted. Increase the limit to continue.';
      case 'missing-profile':
        return 'Host profile unavailable.';
      case 'missing-key':
        return 'OpenRouter key missing from the host profile.';
      case 'model-disabled':
        return 'The acting AI teammate’s model is disabled in the host profile.';
    }
  }
  if (status.state === 'running') {
    return 'AI decision in progress.';
  }
  if (status.state === 'ready') {
    return 'Ready for the next AI decision.';
  }
  return status.enabled ? 'No AI decision is pending.' : 'AI execution is stopped for this game.';
}
