import { useState } from 'react';
import type { GameView, PlayerCommand } from '@regicide/protocol';
import { GameTable } from './GameTable.tsx';

type Selection = { viewVersion: string; ids: string[] };

export function PlayingScreen({
  view,
  viewVersion,
  sync,
  operation,
  actionError,
  onAction,
  onNewGame,
  onResetScenario,
}: {
  view: GameView;
  viewVersion: string;
  sync: 'connecting' | 'ready' | 'awaiting-update';
  operation: 'idle' | 'submitting' | 'resetting';
  actionError: string | null;
  onAction: (command: PlayerCommand) => Promise<'accepted' | 'not-accepted'>;
  onNewGame: () => void;
  onResetScenario?: (() => void) | undefined;
}) {
  const [selection, setSelection] = useState<Selection>({ viewVersion: '', ids: [] });
  const actionPending = operation === 'submitting';
  const resetPending = operation === 'resetting';
  const actionsDisabled = sync !== 'ready' || resetPending;
  const selectedCardIds = selection.viewVersion === viewVersion ? selection.ids : [];

  function toggleCard(cardId: string) {
    if (actionsDisabled || actionPending) return;
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
        <p role="status" className="bg-panel px-4 py-2 text-center text-sm text-foreground">
          {syncMessage}
        </p>
      )}
      <GameTable
        view={view}
        selectedCardIds={selectedCardIds}
        onToggleCard={toggleCard}
        onAction={submit}
        onNewGame={onNewGame}
        onResetScenario={onResetScenario}
        resetPending={resetPending}
        actionPending={actionPending}
        actionsDisabled={actionsDisabled}
        actionError={actionError}
      />
    </main>
  );
}

function getSyncMessage(sync: 'connecting' | 'ready' | 'awaiting-update'): string | null {
  if (sync === 'connecting') return 'Connecting to live game...';
  if (sync === 'awaiting-update') return 'Waiting for game update...';
  return null;
}

function getPhase(view: GameView): string {
  if (view.status === 'game-over') return view.result === 'win' ? 'victory' : 'defeat';
  if (view.interaction.kind === 'damage-discard') return 'discard';
  if (view.interaction.kind === 'turn') return 'play';
  return view.interaction.kind;
}

function getTurn(view: GameView): 'you' | 'other' | undefined {
  if (view.status !== 'active') return undefined;
  return view.currentPlayerId === view.viewer.id ? 'you' : 'other';
}
