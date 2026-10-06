import type { Interaction } from '@regicide/protocol';
import type { PlaySelectionState } from '../../game-interaction/selection.ts';
import { Button } from '../ui/Button.tsx';
import type { TableProps } from './table.types.ts';

type DecisionProps = Pick<
  TableProps,
  'view' | 'selectedCardIds' | 'actionPending' | 'actionError' | 'onAction' | 'onNewGame'
> & { playSelection: PlaySelectionState; selectedDamage: number; hasOpponents: boolean };

export function DecisionArea({
  view,
  selectedCardIds,
  playSelection,
  selectedDamage,
  hasOpponents,
  actionPending,
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
          <Button onClick={onNewGame}>Start New Solo Game</Button>
        </div>
      ) : (
        <InteractionControls
          interaction={view.interaction}
          selectedCardIds={selectedCardIds}
          playSelection={playSelection}
          selectedDamage={selectedDamage}
          actionPending={actionPending}
          onAction={onAction}
        />
      )}
      {actionError && (
        <p role="alert" className="mt-2 text-danger">
          {actionError}
        </p>
      )}
      {actionPending && (
        <p role="status" className="mt-2 text-sm">
          Submitting action...
        </p>
      )}
    </section>
  );
}

function InteractionControls({
  interaction,
  selectedCardIds,
  playSelection,
  selectedDamage,
  actionPending,
  onAction,
}: {
  interaction: Interaction;
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
          <p>
            <span className="lg:hidden">
              {playSelection.kind === 'empty'
                ? 'Select cards'
                : playSelection.kind === 'valid'
                  ? 'Ready to play'
                  : `Invalid play: ${playSelection.reason}`}
            </span>
            <span className="hidden lg:inline">
              {playSelection.kind === 'empty'
                ? 'Select cards from your hand.'
                : playSelection.kind === 'valid'
                  ? 'Legal play selected.'
                  : `Invalid play: ${playSelection.reason}`}
            </span>
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
            {interaction.requiredDamage === 0 ? (
              <p>No cards need to be discarded.</p>
            ) : interaction.canAcceptDefeat ? (
              <p>
                Your hand cannot absorb {interaction.requiredDamage} damage. Use a Solo Jester or
                accept defeat.
              </p>
            ) : (
              <p>Select cards to discard.</p>
            )}
            {interaction.requiredDamage > 0 && (
              <p>
                Selected damage: {selectedDamage} / {interaction.requiredDamage}
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
      return <p className="mt-2">Waiting for another player.</p>;
    case 'choose-next-player':
      return <p className="mt-2">Choosing the next player is not supported by the solo UI yet.</p>;
  }
}
