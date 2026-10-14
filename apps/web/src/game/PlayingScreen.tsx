import { useLayoutEffect, useState } from 'react';
import type {
  AgentPausedMessage,
  AgentStatus,
  GameView,
  PlayerCommand,
  UpdateGameAgentSettingsRequest,
} from '@regicide/protocol';
import { AgentControls } from '../agents/AgentControls.tsx';
import { GameTable } from './table/GameTable.tsx';
import { useGamePresentation } from './presentation/GamePresentationContext.ts';

type Selection = { viewVersion: string; ids: string[] };

export function PlayingScreen({
  view,
  viewVersion,
  sync,
  operation,
  actionError,
  onAction,
  onNewGame,
  onReturnHome,
  isHost,
  agentStatus,
  agentPause,
  agentStatusError,
  onRefreshAgentStatus,
  onUpdateAgentSettings,
  onRetryAgent,
  onOpenAiSettings,
}: {
  view: GameView;
  viewVersion: string;
  sync: 'connecting' | 'ready' | 'awaiting-update';
  operation: 'idle' | 'submitting';
  actionError: string | null;
  onAction: (command: PlayerCommand) => Promise<'accepted' | 'not-accepted'>;
  onNewGame: () => void;
  onReturnHome: () => void;
  isHost: boolean;
  agentStatus: AgentStatus | null;
  agentPause: AgentPausedMessage | null;
  agentStatusError: string | null;
  onRefreshAgentStatus: () => void;
  onUpdateAgentSettings: (settings: UpdateGameAgentSettingsRequest) => Promise<void>;
  onRetryAgent: () => Promise<void>;
  onOpenAiSettings?: (() => void) | undefined;
}) {
  const { cancelPresentations } = useGamePresentation();
  useLayoutEffect(() => () => cancelPresentations(), [cancelPresentations]);
  const [selection, setSelection] = useState<Selection>({ viewVersion: '', ids: [] });
  const actionPending = operation === 'submitting';
  const actionsDisabled = sync !== 'ready';
  const selectedCardIds = selection.viewVersion === viewVersion ? selection.ids : [];

  function toggleCard(cardId: string) {
    if (actionsDisabled || actionPending) {
      return;
    }
    setSelection((current) => {
      const ids = current.viewVersion === viewVersion ? current.ids : [];
      return {
        viewVersion,
        ids: ids.includes(cardId) ? ids.filter((id) => id !== cardId) : [...ids, cardId],
      };
    });
  }

  async function submit(command: PlayerCommand) {
    if ((await onAction(command)) === 'accepted') {
      setSelection({ viewVersion: '', ids: [] });
    }
  }

  const syncMessage = getSyncMessage(sync);
  const phase = getPhase(view);
  const turn = getTurn(view);

  return (
    <main
      className="min-h-svh bg-table font-sans lg:min-h-dvh"
      data-verify="game"
      data-phase={phase}
      data-turn={turn}
    >
      {syncMessage && (
        <p
          role="status"
          className="pointer-events-none fixed top-4 left-1/2 z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-border bg-panel px-4 py-2 text-center text-sm text-foreground shadow-lg"
        >
          {syncMessage}
        </p>
      )}
      {agentPause && (
        <p role="status" className="bg-panel px-4 py-2 text-center text-sm text-foreground">
          AI teammate paused. Waiting for the host to resolve the issue.
        </p>
      )}
      {isHost && view.players.some((player) => player.controller === 'agent') && (
        <details
          className="mx-auto max-w-7xl bg-panel text-foreground"
          onToggle={(event) => {
            if (event.currentTarget.open) {
              onRefreshAgentStatus();
            }
          }}
        >
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
            AI status &amp; controls
            {getAgentStatusSuffix(agentPause)}
          </summary>
          <div className="px-4 pb-3">
            <AgentControls
              status={agentStatus}
              agentPause={agentPause}
              statusError={agentStatusError}
              onRefresh={onRefreshAgentStatus}
              onUpdate={onUpdateAgentSettings}
              onRetry={onRetryAgent}
              onOpenAiSettings={onOpenAiSettings}
            />
          </div>
        </details>
      )}
      <GameTable
        view={view}
        selectedCardIds={selectedCardIds}
        onToggleCard={toggleCard}
        onAction={submit}
        onNewGame={onNewGame}
        onReturnHome={onReturnHome}
        actionPending={actionPending}
        actionsDisabled={actionsDisabled}
        actionError={actionError}
      />
    </main>
  );
}

function getAgentStatusSuffix(pause: AgentPausedMessage | null): string {
  switch (pause?.reason) {
    case 'failure':
      return ' - Decision paused';
    case 'budget-exhausted':
      return ' - Budget exhausted';
    case 'unconfigured':
      return ' - Configuration needed';
    case 'stopped':
      return ' - Stopped';
    default:
      return '';
  }
}

function getSyncMessage(sync: 'connecting' | 'ready' | 'awaiting-update'): string | null {
  if (sync === 'connecting') {
    return 'Connecting to live game...';
  }
  if (sync === 'awaiting-update') {
    return 'Waiting for game update...';
  }
  return null;
}

function getPhase(view: GameView): string {
  if (view.status === 'game-over') {
    return view.result === 'win' ? 'victory' : 'defeat';
  }
  if (view.interaction.kind === 'damage-discard') {
    return 'discard';
  }
  if (view.interaction.kind === 'turn') {
    return 'play';
  }
  return view.interaction.kind;
}

function getTurn(view: GameView): 'you' | 'other' | undefined {
  if (view.status !== 'active') {
    return undefined;
  }
  return view.currentPlayerId === view.viewer.id ? 'you' : 'other';
}
