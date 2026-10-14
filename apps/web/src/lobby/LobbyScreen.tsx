import { useState, type FormEvent } from 'react';
import { REQUEST_BUDGET_BOUNDS } from '@regicide/protocol';
import type {
  AgentModelId,
  AgentStatus,
  LobbyView,
  ProfileView,
  UpdateGameAgentSettingsRequest,
} from '@regicide/protocol';
import { agentModels } from '../agents/models.ts';
import { ApiClientError } from '../api-client.ts';
import { Button } from '../ui/Button.tsx';

function modelName(model: AgentModelId) {
  return agentModels.find(({ id }) => id === model)?.label ?? model;
}

function playerName(player: LobbyView['players'][number], playerId: string) {
  if (player.controller === 'agent') {
    return 'AI teammate';
  }
  return player.id === playerId ? 'You' : `Player ${player.id.slice(0, 8)}`;
}

export function LobbyScreen({
  gameId,
  playerId,
  view,
  profileBacked,
  profile,
  pending,
  error,
  onStart,
  agentStatus,
  agentStatusError,
  onRefreshAgentStatus,
  onAddAgent,
  onRemoveAgent,
  onUpdateAgentSettings,
  onOpenAiSettings,
}: {
  gameId: string;
  playerId: string;
  view: LobbyView;
  profileBacked: boolean;
  profile: ProfileView | null;
  pending: boolean;
  error: string | null;
  onStart: (scenario?: string) => void;
  agentStatus: AgentStatus | null;
  agentStatusError: string | null;
  onRefreshAgentStatus: () => void;
  onAddAgent: (model: AgentModelId) => Promise<void>;
  onRemoveAgent: (id: string) => Promise<void>;
  onUpdateAgentSettings: (settings: UpdateGameAgentSettingsRequest) => Promise<void>;
  onOpenAiSettings: () => void;
}) {
  const [scenario, setScenario] = useState('');
  const [selectedModel, setSelectedModel] = useState<AgentModelId | null>(null);
  const [slotPending, setSlotPending] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<string | null>(null);
  const [budgetPending, setBudgetPending] = useState(false);
  const [budgetMessage, setBudgetMessage] = useState<string | null>(null);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const isHost = view.hostPlayerId === playerId;
  const aiPlayers = view.players.filter((player) => player.controller === 'agent');
  const enabled = agentModels.filter(({ id }) => profile?.enabledModels.includes(id));
  const model = enabled.find(({ id }) => id === selectedModel)?.id ?? enabled[0]?.id;
  const canAdd =
    profileBacked && profile?.hasOpenRouterKey && model !== undefined && view.players.length < 4;
  let agentSetup: 'unavailable' | 'configure' | 'full' | 'ready' = 'ready';
  if (!profileBacked) {
    agentSetup = 'unavailable';
  } else if (!profile?.hasOpenRouterKey || enabled.length === 0) {
    agentSetup = 'configure';
  } else if (view.players.length >= 4) {
    agentSetup = 'full';
  }

  async function updateSlot(action: () => Promise<void>) {
    if (slotPending || pending) {
      return;
    }
    setSlotPending(true);
    setSlotError(null);
    try {
      await action();
    } catch (cause) {
      setSlotError(message(cause, 'Could not update AI teammate.'));
    } finally {
      setSlotPending(false);
    }
  }

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (budgetPending || pending) {
      return;
    }
    const maxRequests = Number(budgetDraft ?? agentStatus?.maxRequests ?? 50);
    if (
      !Number.isInteger(maxRequests) ||
      maxRequests < REQUEST_BUDGET_BOUNDS.min ||
      maxRequests > REQUEST_BUDGET_BOUNDS.max
    ) {
      setBudgetError(
        `Enter a request budget from ${REQUEST_BUDGET_BOUNDS.min} to ${REQUEST_BUDGET_BOUNDS.max}.`,
      );
      return;
    }
    setBudgetPending(true);
    setBudgetError(null);
    setBudgetMessage(null);
    try {
      await onUpdateAgentSettings({ maxRequests });
      setBudgetDraft(null);
      setBudgetMessage('Request budget updated.');
    } catch (cause) {
      setBudgetError(message(cause, 'Could not update request budget.'));
    } finally {
      setBudgetPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 font-sans text-foreground">
      <section className="w-full max-w-md rounded-xl border border-border bg-panel p-5 shadow-xl sm:p-8">
        <p className="text-sm font-medium uppercase tracking-widest text-card-selected">
          Co-op game
        </p>
        <h1 className="mt-2 text-3xl font-bold">Game lobby</h1>
        <p className="mt-6 text-sm text-muted-foreground">
          Share this game ID with the other players:
        </p>
        <p
          className="mt-2 break-all rounded-lg border border-border bg-background p-3 font-mono text-sm"
          aria-label="Game ID"
        >
          {gameId}
        </p>
        <h2 className="mt-6 text-lg font-semibold">Players ({view.players.length}/4)</h2>
        <ul className="mt-3 space-y-2">
          {view.players.map((player) => (
            <li
              key={player.id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span className="min-w-0 break-words font-medium" title={player.id}>
                {playerName(player, playerId)}
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                {player.controller === 'agent' && (
                  <span className="min-w-0 break-words text-muted-foreground">
                    {modelName(player.model)}
                  </span>
                )}
                {player.id === view.hostPlayerId && (
                  <span className="text-card-selected">HOST</span>
                )}
                {isHost && player.controller === 'agent' && (
                  <button
                    type="button"
                    className="min-h-10 rounded text-danger underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-selected disabled:opacity-50"
                    disabled={slotPending || pending}
                    onClick={() => void updateSlot(() => onRemoveAgent(player.id))}
                    aria-label={`Remove AI teammate ${player.id.slice(0, 8)}`}
                  >
                    Remove
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
        {isHost && (
          <>
            <section className="mt-5 border-t border-border pt-5" aria-label="Add AI teammate">
              <h2 className="text-lg font-semibold">Add AI teammate</h2>
              {agentSetup === 'unavailable' && (
                <p className="mt-2 text-sm text-muted-foreground">
                  AI must be configured before creating a new profile-backed game. This human-only
                  lobby cannot be upgraded.
                </p>
              )}
              {agentSetup === 'configure' && (
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>Configure an OpenRouter key and enable a model to add AI teammates.</p>
                  <button
                    type="button"
                    onClick={onOpenAiSettings}
                    className="mt-2 min-h-10 rounded text-card-selected underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-selected"
                  >
                    Open AI Settings
                  </button>
                </div>
              )}
              {agentSetup === 'full' && (
                <p className="mt-2 text-sm text-muted-foreground">The lobby is full (4/4).</p>
              )}
              {agentSetup === 'ready' && (
                <div className="mt-3 space-y-3">
                  {enabled.length === 1 ? (
                    <p className="text-sm text-muted-foreground">Model: {enabled[0]?.label}</p>
                  ) : (
                    <label htmlFor="teammate-model" className="block text-sm font-medium">
                      Model
                      <select
                        id="teammate-model"
                        value={model}
                        onChange={(event) => setSelectedModel(event.target.value as AgentModelId)}
                        disabled={slotPending || pending}
                        className="mt-2 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-selected"
                      >
                        {enabled.map(({ id, label }) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <Button
                    className="w-full"
                    disabled={!canAdd || pending || slotPending}
                    onClick={() => void updateSlot(() => onAddAgent(model!))}
                  >
                    {slotPending ? 'Adding...' : '+ Add AI teammate'}
                  </Button>
                </div>
              )}
              {slotError && (
                <p role="alert" className="mt-2 text-sm text-danger">
                  {slotError}
                </p>
              )}
            </section>
            <section
              className="mt-5 border-t border-border pt-5"
              aria-label="Shared request budget"
            >
              <h2 className="text-lg font-semibold">Shared request budget</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Combined limit for all AI teammates, not an exact monetary spending limit.
              </p>
              <form
                onSubmit={(event) => void saveBudget(event)}
                className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
              >
                <label htmlFor="lobby-agent-budget" className="min-w-0 flex-1 text-sm font-medium">
                  Maximum requests ({REQUEST_BUDGET_BOUNDS.min}–{REQUEST_BUDGET_BOUNDS.max})
                  <input
                    id="lobby-agent-budget"
                    type="number"
                    min={REQUEST_BUDGET_BOUNDS.min}
                    max={REQUEST_BUDGET_BOUNDS.max}
                    step={1}
                    required
                    value={budgetDraft ?? agentStatus?.maxRequests ?? 50}
                    onChange={(event) => setBudgetDraft(event.target.value)}
                    disabled={pending || budgetPending}
                    className="mt-2 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-selected"
                  />
                </label>
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={pending || budgetPending || agentStatus === null}
                >
                  Save budget
                </Button>
              </form>
              {agentStatusError && (
                <p role="alert" className="mt-2 text-sm text-danger">
                  {agentStatusError}{' '}
                  <button type="button" onClick={onRefreshAgentStatus} className="underline">
                    Retry status
                  </button>
                </p>
              )}
              {budgetError && (
                <p role="alert" className="mt-2 text-sm text-danger">
                  {budgetError}
                </p>
              )}
              {budgetMessage && (
                <p role="status" className="mt-2 text-sm text-muted-foreground">
                  {budgetMessage}
                </p>
              )}
            </section>
          </>
        )}
        <div className="mt-6">
          {isHost ? (
            <div className="flex flex-col gap-3">
              {import.meta.env.DEV && (
                <label htmlFor="coop-scenario" className="flex flex-col gap-2 font-medium">
                  Scenario
                  <select
                    id="coop-scenario"
                    value={scenario}
                    onChange={(event) => setScenario(event.target.value)}
                    disabled={pending || slotPending}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-selected"
                  >
                    <option value="">Normal game</option>
                    <option value="enemy-defeat-exact-vs-overkill">
                      Enemy defeat - exact vs overkill
                    </option>
                  </select>
                </label>
              )}
              {aiPlayers.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Starting can initiate billable requests using the host's OpenRouter key.
                </p>
              )}
              <Button
                className="w-full"
                disabled={pending || slotPending || budgetPending}
                onClick={() => onStart(import.meta.env.DEV && scenario ? scenario : undefined)}
              >
                {pending ? 'Please wait...' : 'Start game'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for the host to start.</p>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}

function message(cause: unknown, fallback: string): string {
  return cause instanceof ApiClientError ? `${cause.message} (${cause.code})` : fallback;
}
