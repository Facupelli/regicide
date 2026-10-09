import { useState, type FormEvent } from 'react';
import type { AgentModelId, ProfileView, UpdateProfileAiRequest } from '@regicide/protocol';
import { agentModels } from '../agents/models.ts';
import { ApiClientError } from '../api-client.ts';
import { Button } from '../ui/Button.tsx';

export function AiSettingsScreen({
  profile,
  loading,
  loadError,
  onRetryLoad,
  onBack,
  onSave,
  onRevoke,
}: {
  profile: ProfileView | null;
  loading: boolean;
  loadError: string | null;
  onRetryLoad: () => void;
  onBack: () => void;
  onSave: (settings: UpdateProfileAiRequest) => Promise<void>;
  onRevoke: () => Promise<void>;
}) {
  return (
    <main className="relative z-110 flex min-h-dvh items-center justify-center bg-background px-4 py-10 font-sans text-foreground">
      <section className="w-full max-w-md rounded-xl border border-border bg-panel p-5 shadow-xl sm:p-8">
        <button
          type="button"
          onClick={onBack}
          className="rounded text-sm text-card-selected underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-selected"
        >
          Back
        </button>
        <h1 className="mt-4 text-3xl font-bold">AI Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure AI models for cooperative games.
        </p>
        {loading && (
          <p role="status" className="mt-6 text-sm">
            Loading profile...
          </p>
        )}
        {loadError && (
          <div className="mt-6">
            <p role="alert" className="text-sm text-danger">
              {loadError}
            </p>
            <Button className="mt-3 w-full" onClick={onRetryLoad}>
              Try again
            </Button>
          </div>
        )}
        {profile && !loading && !loadError && (
          <SettingsForm key={profile.id} profile={profile} onSave={onSave} onRevoke={onRevoke} />
        )}
      </section>
    </main>
  );
}

function SettingsForm({
  profile,
  onSave,
  onRevoke,
}: {
  profile: ProfileView;
  onSave: (settings: UpdateProfileAiRequest) => Promise<void>;
  onRevoke: () => Promise<void>;
}) {
  const [keyInput, setKeyInput] = useState('');
  const [enabledModels, setEnabledModels] = useState<AgentModelId[]>([...profile.enabledModels]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const modelsChanged = agentModels.some(
    ({ id }) => enabledModels.includes(id) !== profile.enabledModels.includes(id),
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const apiKey = keyInput.trim();
    if (!apiKey && !modelsChanged) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await onSave({ ...(apiKey ? { apiKey } : {}), enabledModels });
      setKeyInput('');
      setNotice('AI settings saved. Any saved key has not been tested against OpenRouter.');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setPending(false);
    }
  }

  async function revoke() {
    if (pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await onRevoke();
      setKeyInput('');
      setNotice('OpenRouter key removed. Enabled models were kept.');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="mt-6 space-y-4">
      <section className="rounded-lg border border-border bg-background p-4">
        <h2 className="text-lg font-semibold">OpenRouter</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile.hasOpenRouterKey ? 'Key configured' : 'No key configured'}
        </p>
        <label htmlFor="openrouter-key" className="mt-4 block text-sm font-medium">
          {profile.hasOpenRouterKey ? 'Replace API key (optional)' : 'API key'}
        </label>
        <input
          id="openrouter-key"
          type="password"
          autoComplete="off"
          value={keyInput}
          onChange={(event) => setKeyInput(event.target.value)}
          disabled={pending}
          className="mt-2 w-full min-w-0 rounded-lg border border-border bg-panel px-3 py-2 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-selected"
        />
        <a
          href="https://openrouter.ai/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm text-card-selected underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-selected"
        >
          Get an OpenRouter key
        </a>
        {profile.hasOpenRouterKey && (
          <button
            type="button"
            disabled={pending}
            onClick={() => void revoke()}
            className="mt-4 block min-h-10 rounded text-sm text-danger underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-selected disabled:opacity-50"
          >
            Remove key
          </button>
        )}
      </section>
      <fieldset disabled={pending} className="rounded-lg border border-border bg-background p-4">
        <legend className="sr-only">Enabled models</legend>
        <h2 className="text-lg font-semibold">Enabled models</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose models available for new AI teammates.
        </p>
        <div className="mt-3 space-y-2">
          {agentModels.map(({ id, label }) => (
            <label
              key={id}
              className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={enabledModels.includes(id)}
                onChange={(event) =>
                  setEnabledModels((current) =>
                    event.target.checked
                      ? [...current, id]
                      : current.filter((model) => model !== id),
                  )
                }
                className="size-5 accent-card-selected focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-selected"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <Button
        type="submit"
        className="w-full"
        disabled={pending || (!keyInput.trim() && !modelsChanged)}
      >
        {pending ? 'Saving...' : 'Save AI settings'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Saving a key does not verify it with OpenRouter. AI requests may incur charges.
      </p>
    </form>
  );
}

function message(cause: unknown): string {
  return cause instanceof ApiClientError
    ? `${cause.message} (${cause.code})`
    : 'Could not update AI settings. Please try again.';
}
