import { evaluatePlaySelection, selectedDamageValue } from '../../game-interaction/selection.ts';
import { BattleArea } from './BattleArea.tsx';
import { DecisionArea } from './DecisionArea.tsx';
import { EnemyArea } from './EnemyArea.tsx';
import { PlayerArea } from './PlayerArea.tsx';
import { PlayerHand } from './PlayerHand.tsx';
import { ResourceArea } from './ResourceArea.tsx';
import type { TableProps } from './table.types.ts';

export function GameTable(props: TableProps) {
  const { view, selectedCardIds } = props;
  const battle = view.status === 'active' || view.result === 'loss' ? view.battle : undefined;
  const hasOpponents = view.players.some((player) => player.id !== view.viewer.id);
  return (
    <div
      className={`mx-auto grid min-h-dvh max-w-7xl grid-cols-[minmax(4rem,5rem)_minmax(0,1fr)_minmax(4rem,5rem)] gap-2 bg-table px-3 py-3 text-foreground lg:grid-cols-[minmax(6rem,8rem)_minmax(0,1fr)_minmax(6rem,8rem)] lg:grid-rows-[auto_auto_minmax(7rem,18rem)_auto_auto] lg:content-center lg:gap-x-4 lg:gap-y-2 lg:px-6 lg:py-4 ${hasOpponents ? 'grid-rows-[auto_auto_minmax(5rem,1fr)_auto_auto_auto]' : 'grid-rows-[auto_minmax(5rem,1fr)_auto_auto_auto]'}`}
    >
      <PlayerArea view={view} />
      <EnemyArea battle={battle} hasOpponents={hasOpponents} />
      <BattleArea battle={battle} hasOpponents={hasOpponents} />
      <DecisionArea
        {...props}
        hasOpponents={hasOpponents}
        playSelection={evaluatePlaySelection(view.viewer.hand, selectedCardIds)}
        selectedDamage={selectedDamageValue(view.viewer.hand, selectedCardIds)}
      />
      <ResourceArea view={view} hasOpponents={hasOpponents} />
      <PlayerHand {...props} hasOpponents={hasOpponents} />
    </div>
  );
}
