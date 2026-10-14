import type { CSSProperties } from 'react';
import { evaluatePlaySelection } from '../interaction/selection.ts';
import { useGamePresentation } from '../presentation/GamePresentationContext.ts';
import { gamePresentationAnchor } from '../presentation/game-presentation.types.ts';
import { PlayingCard } from '../cards/PlayingCard.tsx';
import { PlayerSeat } from './PlayerArea.tsx';
import type { TableProps } from './table.types.ts';

function handTrackStyle(count: number): CSSProperties {
  // The last column holds a full card; earlier columns shrink evenly when the hand fills up.
  return {
    gridTemplateColumns:
      count === 1
        ? 'var(--hand-card-width)'
        : `repeat(${count - 1}, minmax(0, 1fr)) var(--hand-card-width)`,
    '--hand-max-width': `calc(${count} * var(--hand-card-width) + ${count - 1} * 0.5rem)`,
  } as CSSProperties;
}

export function PlayerHand({
  view,
  selectedCardIds,
  onToggleCard,
  actionPending,
  actionsDisabled,
  hasOpponents,
}: Pick<
  TableProps,
  'view' | 'selectedCardIds' | 'onToggleCard' | 'actionPending' | 'actionsDisabled'
> & {
  hasOpponents: boolean;
}) {
  const { registerAnchor } = useGamePresentation();
  const interaction = view.status === 'active' ? view.interaction : null;
  const canSelect =
    interaction?.kind === 'turn' ||
    (interaction?.kind === 'damage-discard' &&
      interaction.requiredDamage > 0 &&
      !interaction.canAcceptDefeat);
  const selected = view.viewer.hand.filter((card) => selectedCardIds.includes(card.id));
  const local = view.players.find((player) => player.id === view.viewer.id);
  return (
    <section
      ref={(element) => registerAnchor(gamePresentationAnchor.localHand, element)}
      className={`relative col-span-3 min-w-0 [--hand-card-width:clamp(4.5rem,19vw,6.5rem)] lg:col-span-1 lg:col-start-2 lg:row-start-5 ${hasOpponents ? 'row-start-6' : 'row-start-5'}`}
      aria-label="Your hand"
    >
      <div className="absolute top-7 left-1 flex -translate-y-full flex-wrap items-center justify-between gap-2 lg:static lg:mb-2 lg:translate-y-0">
        <h2 className="text-xs font-normal lg:text-sm lg:font-semibold">
          Your hand<span className="hidden lg:inline"> ({view.viewer.hand.length})</span>
        </h2>
        {local && (
          <div className="hidden lg:block">
            <PlayerSeat
              player={local}
              local
              active={view.status === 'active' && view.currentPlayerId === local.id}
            />
          </div>
        )}
      </div>
      {view.viewer.hand.length ? (
        <div className="max-w-full px-1 pt-8 lg:flex lg:items-end lg:overflow-x-auto lg:justify-center lg:gap-1 lg:pt-3 xl:gap-2">
          <div
            className="mx-auto grid w-full max-w-[var(--hand-max-width)] lg:contents"
            style={handTrackStyle(view.viewer.hand.length)}
          >
            {view.viewer.hand.map((card) => {
              const isSelected = selectedCardIds.includes(card.id);
              const candidate =
                interaction?.kind === 'turn' && selected.length && !isSelected
                  ? evaluatePlaySelection(view.viewer.hand, [...selectedCardIds, card.id])
                  : null;
              const unavailableReason =
                candidate?.kind === 'invalid' ? candidate.reason : undefined;
              return (
                <div
                  key={card.id}
                  className={`relative justify-self-start has-[:focus-visible]:z-20 lg:shrink-0 lg:has-[:focus-visible]:z-auto ${isSelected ? 'z-10 lg:z-auto' : ''}`}
                >
                  <PlayingCard
                    card={card}
                    variant="hand"
                    elementRef={(element) =>
                      registerAnchor(gamePresentationAnchor.card(card.id), element)
                    }
                    selected={isSelected}
                    unavailableReason={unavailableReason}
                    disabled={actionPending || actionsDisabled}
                    onToggle={canSelect ? () => onToggleCard(card.id) : undefined}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid place-items-center px-1 pt-8 lg:block lg:p-0">
          <span className="invisible col-start-1 row-start-1 lg:hidden" aria-hidden="true">
            <PlayingCard variant="hand" />
          </span>
          <p className="col-start-1 row-start-1 text-sm text-muted-foreground">No cards in hand.</p>
        </div>
      )}
    </section>
  );
}
