import type { BattleView, Suit } from '@regicide/protocol';
import { useGamePresentation } from '../presentation/GamePresentationContext.ts';
import { gamePresentationAnchor } from '../presentation/game-presentation.types.ts';
import { PlayingCard } from '../cards/PlayingCard.tsx';
import { HeartIcon, ShieldIcon, SwordIcon } from './GameStatIcons.tsx';

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
  const { registerAnchor } = useGamePresentation();
  return (
    <section
      className={`flex items-center gap-4 lg:col-span-1 lg:col-start-2 lg:row-start-2 lg:flex-row lg:justify-center lg:gap-6 lg:text-left ${hasOpponents ? 'col-span-2 col-start-2 row-start-2 flex-row justify-start text-left' : 'col-span-3 col-start-1 row-start-1 flex-col justify-center text-center'}`}
      aria-label="Enemy"
    >
      {battle ? (
        <>
          <PlayingCard
            card={battle.enemy}
            variant="enemy"
            elementRef={(element) => registerAnchor(gamePresentationAnchor.enemy, element)}
          />
          <div className="min-w-0 space-y-1.5 lg:max-w-64 lg:space-y-3">
            <div
              className={`flex text-sm lg:block lg:space-y-3 ${hasOpponents ? 'flex-col items-start gap-1.5' : 'items-center justify-center gap-3'}`}
            >
              <div
                className={`${hasOpponents ? 'flex gap-2' : 'contents'} lg:flex lg:justify-start lg:gap-4`}
              >
                <span className="inline-flex items-center gap-1">
                  <span className="sr-only">Health </span>
                  <HeartIcon className="size-4" />
                  <strong className="whitespace-nowrap" data-verify="enemy-health">
                    {Math.max(0, battle.enemyHealth - battle.damageDealt)} / {battle.enemyHealth}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="sr-only">Attack </span>
                  <SwordIcon className="size-4" />
                  <strong data-verify="enemy-attack">{battle.enemyAttack}</strong>
                  {battle.shield > 0 && (
                    <span className="whitespace-nowrap text-muted-foreground">
                      <span className="sr-only">Effective attack </span>(
                      {Math.max(0, battle.enemyAttack - battle.shield)})
                    </span>
                  )}
                </span>
              </div>
              <div className={`${hasOpponents ? 'flex' : 'contents'} lg:flex lg:justify-start`}>
                <span className="inline-flex items-center gap-1">
                  <span className="sr-only">Shield </span>
                  <ShieldIcon className="size-4" />
                  <strong data-verify="enemy-shield">{battle.shield}</strong>
                </span>
              </div>
            </div>
            <p
              className={`text-xs text-muted-foreground lg:whitespace-normal ${hasOpponents ? 'whitespace-normal' : 'whitespace-nowrap'}`}
            >
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
