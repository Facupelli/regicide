import { useGamePresentation } from '../presentation/GamePresentationContext.ts';
import { gamePresentationAnchor } from '../presentation/game-presentation.types.ts';
import type { TableProps } from './table.types.ts';
import { PlayingCard } from '../cards/PlayingCard.tsx';

function ResourcePile({
  label,
  count,
  jester = false,
  className,
  usable = false,
  actionPending = false,
  onUse,
  cardElementRef,
}: {
  label: string;
  count: number;
  jester?: boolean;
  className: string;
  usable?: boolean;
  actionPending?: boolean;
  onUse?: () => void;
  cardElementRef?: (element: HTMLElement | null) => void;
}) {
  const contents = (
    <>
      <div className="relative">
        <PlayingCard
          {...(cardElementRef ? { elementRef: cardElementRef } : {})}
          variant="pile"
          label={`${label} pile`}
          {...(jester ? { card: { kind: 'jester' as const, id: 'solo-resource' } } : {})}
        />
        <span
          className="absolute right-0 bottom-0 flex min-h-6 min-w-6 translate-x-1/3 translate-y-1/3 items-center justify-center rounded-full border border-card-border bg-panel px-1 text-xs leading-none text-foreground shadow-md"
          aria-hidden="true"
        >
          {count}
        </span>
      </div>
      <span className="mt-1 text-xs text-muted-foreground">{label}</span>
    </>
  );
  const classes = `flex min-w-0 flex-col items-center justify-center gap-0.5 text-center ${className}`;
  if (jester) {
    return (
      <button
        type="button"
        className={`${classes} rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-selected enabled:cursor-pointer enabled:hover:brightness-125 disabled:cursor-not-allowed`}
        aria-label={
          usable
            ? `Use Solo Jester (${count} remaining)`
            : `Solo Jesters: ${count} remaining, unavailable`
        }
        disabled={!usable || actionPending}
        onClick={onUse}
      >
        {contents}
        {!usable && <span className="text-xs text-muted-foreground">Unavailable</span>}
      </button>
    );
  }
  return (
    <div className={classes} aria-label={`${label}: ${count} cards`}>
      {contents}
    </div>
  );
}

export function ResourceArea({
  view,
  hasOpponents,
  actionPending,
  actionsDisabled,
  onAction,
}: Pick<TableProps, 'view' | 'actionPending' | 'actionsDisabled' | 'onAction'> & {
  hasOpponents: boolean;
}) {
  const { registerAnchor } = useGamePresentation();
  const usable =
    view.status === 'active' &&
    (view.interaction.kind === 'turn' || view.interaction.kind === 'damage-discard') &&
    view.interaction.canUseSoloJester;

  return (
    <section className="contents" aria-label="Game resources">
      <ResourcePile
        label="Castle"
        count={view.castle.remainingCards}
        className={`col-start-1 lg:row-start-2 lg:mt-0 lg:self-stretch ${!hasOpponents && (view.status === 'active' || view.result === 'loss') ? 'mt-10 self-start sm:mt-[4.25rem]' : 'self-center'} ${hasOpponents ? 'row-start-2' : 'row-start-1'}`}
      />
      <div
        className={`col-span-3 flex items-start lg:contents ${hasOpponents ? 'row-start-5' : 'row-start-4'} ${view.soloJestersRemaining !== null ? 'justify-between' : 'justify-center'}`}
      >
        <div className="flex items-start gap-6 [--pile-card-width:3rem] sm:[--pile-card-width:3.5rem] lg:contents lg:[--pile-card-width:3rem]">
          <ResourcePile
            label="Tavern"
            cardElementRef={(element) => registerAnchor(gamePresentationAnchor.tavern, element)}
            count={view.tavern.remainingCards}
            className="lg:col-start-3 lg:row-start-2"
          />
          <ResourcePile
            label="Discard"
            cardElementRef={(element) => registerAnchor(gamePresentationAnchor.discard, element)}
            count={view.discard.cards.length}
            className="lg:col-start-1 lg:row-start-3"
          />
        </div>
        {view.soloJestersRemaining !== null && (
          <ResourcePile
            label="Solo Jesters"
            count={view.soloJestersRemaining}
            jester
            usable={usable}
            actionPending={actionPending || actionsDisabled}
            onUse={() => onAction({ kind: 'use-solo-jester' })}
            className="lg:col-start-3 lg:row-start-3"
          />
        )}
      </div>
    </section>
  );
}
