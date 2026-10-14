import type { Interaction } from '@regicide/protocol';
import type { PlaySelectionState } from '../interaction/selection.ts';
import { Button } from '../../ui/Button.tsx';
import type { TableProps } from './table.types.ts';

type DecisionProps = Pick<
  TableProps,
  | 'view'
  | 'selectedCardIds'
  | 'actionPending'
  | 'actionsDisabled'
  | 'actionError'
  | 'onAction'
  | 'onNewGame'
> & { playSelection: PlaySelectionState; selectedDamage: number; hasOpponents: boolean };

export function DecisionArea({
  view,
  selectedCardIds,
  playSelection,
  selectedDamage,
  hasOpponents,
  actionPending,
  actionsDisabled,
  actionError,
  onAction,
  onNewGame,
}: DecisionProps) {
  return (
    <section
      className={`col-span-3 self-end rounded-lg border border-border bg-panel/80 px-3 py-2 text-sm lg:self-auto lg:text-base [&_button]:px-2 [&_button]:py-1.5 [&_button]:text-sm sm:[&_button]:px-3 sm:[&_button]:py-2 sm:[&_button]:text-base lg:col-span-1 lg:col-start-2 lg:row-start-4 lg:px-4 ${hasOpponents ? 'row-start-4' : 'row-start-3'}`}
      aria-label="Current decision"
      aria-busy={actionPending}
    >
      {view.status === 'game-over' ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-lg font-semibold">
            {view.result === 'win'
              ? `Victory${view.soloVictoryRank ? ` - ${view.soloVictoryRank}` : ''}`
              : 'Defeat'}
          </p>
          <Button onClick={onNewGame}>
            {view.players.length === 1 ? 'Start New Solo Game' : 'Return home'}
          </Button>
        </div>
      ) : (
        <InteractionControls
          interaction={view.interaction}
          viewerId={view.viewer.id}
          currentPlayerId={view.currentPlayerId}
          selectedCardIds={selectedCardIds}
          playSelection={playSelection}
          selectedDamage={selectedDamage}
          actionPending={actionPending || actionsDisabled}
          onAction={onAction}
        />
      )}
      {actionError && (
        <p role="alert" className="text-danger">
          {actionError}
        </p>
      )}
      {actionPending && (
        <p role="status" className="text-sm">
          Submitting action...
        </p>
      )}
    </section>
  );
}

function selectionMessage(selection: PlaySelectionState, compact: boolean) {
  switch (selection.kind) {
    case 'empty':
      return compact ? 'Select cards' : 'Select cards from your hand.';
    case 'valid':
      return compact ? 'Ready to play' : 'Legal play selected.';
    case 'invalid':
      return `Invalid play: ${selection.reason}`;
  }
}

function damagePrompt(interaction: Extract<Interaction, { kind: 'damage-discard' }>) {
  if (interaction.requiredDamage === 0) {
    return (
      <p data-verify="decision">
        <span data-verify="zero-damage">No cards need to be discarded.</span>
      </p>
    );
  }
  if (interaction.canAcceptDefeat) {
    return (
      <p data-verify="decision">
        Your hand cannot absorb {interaction.requiredDamage} damage. Use a Solo Jester or accept
        defeat.
      </p>
    );
  }
  return <p data-verify="decision">Select cards to discard.</p>;
}

function InteractionControls({
  interaction,
  viewerId,
  currentPlayerId,
  selectedCardIds,
  playSelection,
  selectedDamage,
  actionPending,
  onAction,
}: {
  interaction: Interaction;
  viewerId: string;
  currentPlayerId: string;
  selectedCardIds: string[];
  playSelection: PlaySelectionState;
  selectedDamage: number;
  actionPending: boolean;
  onAction: TableProps['onAction'];
}) {
  switch (interaction.kind) {
    case 'turn':
      return (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p data-verify="decision">
            <span className="lg:hidden">{selectionMessage(playSelection, true)}</span>
            <span className="hidden lg:inline">{selectionMessage(playSelection, false)}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={actionPending || playSelection.kind !== 'valid'}
              onClick={() => onAction({ kind: 'play-cards', cardIds: selectedCardIds })}
            >
              <span className="lg:hidden">Play cards</span>
              <span className="hidden lg:inline">Play selected cards</span>
            </Button>
            {interaction.canYield && (
              <Button disabled={actionPending} onClick={() => onAction({ kind: 'yield' })}>
                Yield
              </Button>
            )}
          </div>
        </div>
      );
    case 'damage-discard':
      return (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div>
            {damagePrompt(interaction)}
            {interaction.requiredDamage > 0 && (
              <p>
                Selected damage: <span data-verify="selected-damage">{selectedDamage}</span> /{' '}
                <span data-verify="required-damage">{interaction.requiredDamage}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {interaction.canAcceptDefeat && (
              <Button
                className="bg-transparent text-danger"
                disabled={actionPending}
                onClick={() => onAction({ kind: 'accept-defeat' })}
              >
                Accept defeat
              </Button>
            )}
            {!interaction.canAcceptDefeat && (
              <Button
                disabled={
                  actionPending ||
                  (interaction.requiredDamage > 0 &&
                    (!selectedCardIds.length || selectedDamage < interaction.requiredDamage))
                }
                onClick={() =>
                  onAction({
                    kind: 'discard-for-damage',
                    cardIds: interaction.requiredDamage === 0 ? [] : selectedCardIds,
                  })
                }
              >
                {interaction.requiredDamage === 0 ? (
                  'Continue turn'
                ) : (
                  <>
                    <span className="lg:hidden">Discard</span>
                    <span className="hidden lg:inline">Discard selected cards</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      );
    case 'waiting':
      return (
        <p data-verify="decision">
          Waiting for Player{' '}
          {currentPlayerId.length > 8 ? `${currentPlayerId.slice(0, 8)}...` : currentPlayerId}.
        </p>
      );
    case 'choose-next-player':
      return (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p data-verify="decision">Choose the next player.</p>
          <div className="flex flex-wrap gap-2">
            {interaction.eligiblePlayerIds.map((playerId) => (
              <Button
                key={playerId}
                disabled={actionPending}
                onClick={() => onAction({ kind: 'choose-next-player', targetPlayerId: playerId })}
              >
                {playerId === viewerId ? 'You' : `Player ${playerId.slice(0, 8)}`}
              </Button>
            ))}
          </div>
        </div>
      );
  }
}
