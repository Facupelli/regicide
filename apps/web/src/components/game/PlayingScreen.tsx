import { useState } from 'react';
import type { GameView, PlayerCommand } from '@regicide/protocol';
import { GameTable } from './GameTable.tsx';

type Selection = { revision: number; ids: string[] };

export function PlayingScreen({
  view,
  revision,
  connection,
  awaitingUpdate,
  actionPending,
  resetPending,
  actionError,
  onAction,
  onNewGame,
  onResetScenario,
}: {
  view: GameView;
  revision: number;
  connection: 'connecting' | 'live';
  awaitingUpdate: boolean;
  actionPending: boolean;
  resetPending: boolean;
  actionError: string | null;
  onAction: (command: PlayerCommand) => void;
  onNewGame: () => void;
  onResetScenario?: (() => void) | undefined;
}) {
  const [selection, setSelection] = useState<Selection>({ revision: -1, ids: [] });
  const actionsDisabled = connection !== 'live' || awaitingUpdate || resetPending;
  const selectedCardIds = selection.revision === revision && !awaitingUpdate ? selection.ids : [];

  function toggleCard(cardId: string) {
    if (actionsDisabled || actionPending) return;
    setSelection((current) => {
      const ids = current.revision === revision ? current.ids : [];
      return {
        revision,
        ids: ids.includes(cardId) ? ids.filter((id) => id !== cardId) : [...ids, cardId],
      };
    });
  }

  const syncMessage = getSyncMessage(connection, awaitingUpdate);
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
        onAction={onAction}
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

function getSyncMessage(connection: 'connecting' | 'live', awaitingUpdate: boolean): string | null {
  if (connection === 'connecting') return 'Connecting to live game...';
  if (awaitingUpdate) return 'Waiting for game update...';
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
