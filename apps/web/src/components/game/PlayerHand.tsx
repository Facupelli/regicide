import { evaluatePlaySelection } from '../../game-interaction/selection.ts';
import { PlayingCard } from '../ui/PlayingCard.tsx';
import { PlayerSeat } from './PlayerArea.tsx';
import type { TableProps } from './table.types.ts';

export function PlayerHand({
  view,
  selectedCardIds,
  onToggleCard,
  actionPending,
  hasOpponents,
}: Pick<TableProps, 'view' | 'selectedCardIds' | 'onToggleCard' | 'actionPending'> & {
  hasOpponents: boolean;
}) {
  const interaction = view.status === 'active' ? view.interaction : null;
  const canSelect = interaction?.kind === 'turn' || interaction?.kind === 'damage-discard';
  const selected = view.viewer.hand.filter((card) => selectedCardIds.includes(card.id));
  const local = view.players.find((player) => player.id === view.viewer.id);
  return (
    <section
      className={`col-span-3 min-w-0 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:col-span-1 lg:col-start-2 lg:row-start-5 ${hasOpponents ? 'row-start-6' : 'row-start-5'}`}
      aria-label="Your hand"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Your hand ({view.viewer.hand.length})</h2>
        {local && (
          <PlayerSeat
            player={local}
            local
            active={view.status === 'active' && view.currentPlayerId === local.id}
          />
        )}
      </div>
      {view.viewer.hand.length ? (
        <div className="flex max-w-full items-end overflow-x-auto px-1 pt-3 pb-2 lg:justify-center lg:gap-1 xl:gap-2">
          {view.viewer.hand.map((card) => {
            const isSelected = selectedCardIds.includes(card.id);
            const candidate =
              interaction?.kind === 'turn' && selected.length && !isSelected
                ? evaluatePlaySelection(view.viewer.hand, [...selectedCardIds, card.id])
                : null;
            const unavailableReason = candidate?.kind === 'invalid' ? candidate.reason : undefined;
            return (
              <div key={card.id} className="-ml-4 shrink-0 first:ml-0 lg:ml-0">
                <PlayingCard
                  card={card}
                  variant="hand"
                  selected={isSelected}
                  unavailableReason={unavailableReason}
                  disabled={actionPending}
                  onToggle={canSelect ? () => onToggleCard(card.id) : undefined}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No cards in hand.</p>
      )}
    </section>
  );
}
