import type { BattleView, Suit } from '@regicide/protocol';
import { PlayingCard } from '../ui/PlayingCard.tsx';
import { HeartIcon, ShieldIcon, SwordIcon } from '../ui/icons/GameStatIcons.tsx';

const blockedSuitEffects: Record<Suit, string> = {
  clubs: 'no double damage',
  diamonds: 'no draws',
  hearts: 'no healing',
  spades: 'no attack reduction',
};

export function EnemyArea({
  battle,
  hasOpponents,
}: {
  battle: BattleView | undefined;
  hasOpponents: boolean;
}) {
  return (
    <section
      className={`col-span-3 col-start-1 flex flex-col items-center justify-center gap-2 text-center lg:col-span-1 lg:col-start-2 lg:row-start-2 lg:flex-row lg:gap-6 lg:text-left ${hasOpponents ? 'row-start-2' : 'row-start-1'}`}
      aria-label="Enemy"
    >
      {battle ? (
        <>
          <PlayingCard card={battle.enemy} variant="enemy" />
          <div className="min-w-0 space-y-1.5 lg:max-w-64 lg:space-y-3">
            <div className="flex items-center justify-center gap-3 text-sm lg:block lg:space-y-3">
              <div className="contents lg:flex lg:justify-start lg:gap-4">
                <span className="inline-flex items-center gap-1">
                  <span className="sr-only">Health </span>
                  <HeartIcon className="size-4" />
                  <strong className="whitespace-nowrap">
                    {Math.max(0, battle.enemyHealth - battle.damageDealt)} / {battle.enemyHealth}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="sr-only">Attack </span>
                  <SwordIcon className="size-4" />
                  <strong>{battle.enemyAttack}</strong>
                </span>
              </div>
              <div className="contents lg:flex lg:justify-start">
                <span className="inline-flex items-center gap-1">
                  <span className="sr-only">Shield </span>
                  <ShieldIcon className="size-4" />
                  <strong>{battle.shield}</strong>
                </span>
              </div>
            </div>
            <p className="whitespace-nowrap text-xs text-muted-foreground lg:whitespace-normal">
              {battle.immunityCancelled
                ? 'Suit immunity cancelled'
                : `Immune to ${battle.enemy.suit}: ${blockedSuitEffects[battle.enemy.suit]}`}
            </p>
          </div>
        </>
      ) : (
        <p className="text-lg font-semibold">The Castle is clear.</p>
      )}
    </section>
  );
}
