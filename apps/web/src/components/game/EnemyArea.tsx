import type { BattleView } from '@regicide/protocol';
import { PlayingCard } from '../ui/PlayingCard.tsx';

export function EnemyArea({
  battle,
  hasOpponents,
}: {
  battle: BattleView | undefined;
  hasOpponents: boolean;
}) {
  return (
    <section
      className={`col-start-2 flex flex-col items-center justify-center gap-2 text-center lg:col-start-2 lg:row-start-2 lg:flex-row lg:gap-6 lg:text-left [@media(max-height:740px)]:flex-row [@media(max-height:740px)]:text-left ${hasOpponents ? 'row-start-2' : 'row-start-1'}`}
      aria-label="Enemy"
    >
      {battle ? (
        <>
          <PlayingCard card={battle.enemy} variant="enemy" />
          <div className="min-w-0 space-y-1.5 lg:max-w-64 lg:space-y-3">
            <div
              aria-label={`Damage dealt ${battle.damageDealt} of ${battle.enemyHealth} enemy health`}
            >
              <div className="flex justify-center gap-2 text-sm lg:justify-between [@media(max-height:740px)]:justify-between">
                <span>Health</span>
                <strong>
                  {Math.max(0, battle.enemyHealth - battle.damageDealt)} / {battle.enemyHealth}
                </strong>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-card-selected"
                  style={{
                    width: `${Math.min(100, (battle.damageDealt / battle.enemyHealth) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex justify-center gap-3 text-sm lg:justify-start [@media(max-height:740px)]:justify-start">
              <span>
                Attack <strong>{battle.enemyAttack}</strong>
              </span>
              <span>
                Shield <strong>{battle.shield}</strong>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {battle.immunityCancelled
                ? 'Suit immunity cancelled'
                : `Immune to ${battle.enemy.suit} effects`}
            </p>
          </div>
        </>
      ) : (
        <p className="text-lg font-semibold">The Castle is clear.</p>
      )}
    </section>
  );
}
