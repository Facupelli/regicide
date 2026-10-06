import type { GameView } from '@regicide/protocol';
import { PlayingCard } from '../ui/PlayingCard.tsx';

function ResourcePile({
  label,
  count,
  jester = false,
  className,
}: {
  label: string;
  count: number;
  jester?: boolean;
  className: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col items-center justify-center gap-0.5 text-center ${className}`}
      aria-label={`${label}: ${count} ${jester ? 'remaining' : 'cards'}`}
    >
      <div className="relative">
        <PlayingCard
          variant="pile"
          label={`${label} pile`}
          {...(jester ? { card: { kind: 'jester' as const, id: 'solo-resource' } } : {})}
        />
        <strong
          className="absolute right-0 bottom-0 flex min-h-6 min-w-6 translate-x-1/3 translate-y-1/3 items-center justify-center rounded-full border border-card-border bg-panel px-1 text-xs leading-none text-foreground shadow-md"
          aria-hidden="true"
        >
          {count}
        </strong>
      </div>
      <span className="mt-1 text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function ResourceArea({ view, hasOpponents }: { view: GameView; hasOpponents: boolean }) {
  return (
    <section className="contents" aria-label="Game resources">
      <ResourcePile
        label="Castle"
        count={view.castle.remainingCards}
        className={`col-start-1 lg:row-start-2 ${hasOpponents ? 'row-start-2' : 'row-start-1'}`}
      />
      <ResourcePile
        label="Tavern"
        count={view.tavern.remainingCards}
        className={`col-start-3 lg:row-start-2 ${hasOpponents ? 'row-start-2' : 'row-start-1'}`}
      />
      <ResourcePile
        label="Discard"
        count={view.discard.cards.length}
        className={`col-start-1 lg:row-start-3 ${hasOpponents ? 'row-start-5' : 'row-start-4'}`}
      />
      {view.soloJestersRemaining !== null && (
        <ResourcePile
          label="Solo Jesters"
          count={view.soloJestersRemaining}
          jester
          className={`col-start-3 lg:row-start-3 ${hasOpponents ? 'row-start-5' : 'row-start-4'}`}
        />
      )}
    </section>
  );
}
