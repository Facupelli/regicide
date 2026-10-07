import type { BattleView } from '@regicide/protocol';
import { useGamePresentation } from '../../game-presentation/GamePresentationContext.ts';
import { gamePresentationAnchor } from '../../game-presentation/game-presentation.types.ts';
import { PlayingCard } from '../ui/PlayingCard.tsx';

export function BattleArea({
  battle,
  hasOpponents,
}: {
  battle: BattleView | undefined;
  hasOpponents: boolean;
}) {
  const { registerAnchor } = useGamePresentation();
  return (
    <section
      className={`relative col-span-3 flex min-h-16 flex-col items-center rounded-xl border border-border/60 bg-panel/30 px-2 py-1 lg:col-span-1 lg:col-start-2 lg:row-start-3 lg:min-h-28 ${hasOpponents ? 'row-start-3' : 'row-start-2'}`}
      aria-label="Battle area"
      data-verify="current-play"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none invisible absolute top-1/2 left-1/2 aspect-5/7 w-16 -translate-x-1/2 -translate-y-1/2 sm:w-18 lg:w-16"
        ref={(element) => registerAnchor(gamePresentationAnchor.battleTarget, element)}
      />
      <h2 className="text-center text-sm leading-tight">Current play</h2>
      {battle?.plays.length ? (
        <div className="flex max-w-full gap-2 overflow-x-auto py-2" aria-label="Accepted plays">
          {battle.plays.map((play, index) => (
            <div
              className="flex shrink-0 gap-0.5 border-r border-border pr-2 last:border-0"
              key={index}
              aria-label={`Play ${index + 1}`}
            >
              {(play.kind === 'attack' ? play.cards : [play.card]).map((card) => (
                <PlayingCard
                  key={card.id}
                  card={card}
                  variant="played"
                  elementRef={(element) =>
                    registerAnchor(gamePresentationAnchor.battleCard(card.id), element)
                  }
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-2 lg:hidden" aria-hidden="true">
          <div className="aspect-5/7 w-16 sm:w-18" />
        </div>
      )}
    </section>
  );
}
