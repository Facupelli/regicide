import { evaluatePlaySelection, selectedDamageValue } from '../interaction/selection.ts';
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
      className={`mx-auto grid min-h-svh max-w-7xl lg:min-h-dvh grid-cols-[minmax(4rem,5rem)_minmax(0,1fr)_minmax(4rem,5rem)] gap-x-2 gap-y-4 bg-table px-3 py-3 text-foreground lg:grid-cols-[minmax(6rem,8rem)_minmax(0,1fr)_minmax(6rem,8rem)] lg:grid-rows-[auto_auto_minmax(7rem,18rem)_auto_auto] lg:content-center lg:gap-x-4 lg:gap-y-2 lg:px-6 lg:py-4 ${hasOpponents ? 'grid-rows-[auto_auto_auto_1fr_auto_auto]' : 'grid-rows-[auto_auto_1fr_auto_auto]'}`}
      data-verify="other-players"
    >
      <PlayerArea view={view} />
      <EnemyArea battle={battle} hasOpponents={hasOpponents} />
      <BattleArea battle={battle} hasOpponents={hasOpponents} />
      <DecisionArea
        view={view}
        selectedCardIds={selectedCardIds}
        actionPending={props.actionPending}
        actionsDisabled={props.actionsDisabled}
        actionError={props.actionError}
        onAction={props.onAction}
        onNewGame={props.onNewGame}
        hasOpponents={hasOpponents}
        playSelection={evaluatePlaySelection(view.viewer.hand, selectedCardIds)}
        selectedDamage={selectedDamageValue(view.viewer.hand, selectedCardIds)}
      />
      <ResourceArea
        view={view}
        actionPending={props.actionPending}
        actionsDisabled={props.actionsDisabled}
        onAction={props.onAction}
        hasOpponents={hasOpponents}
      />
      <PlayerHand
        view={view}
        selectedCardIds={selectedCardIds}
        onToggleCard={props.onToggleCard}
        actionPending={props.actionPending}
        actionsDisabled={props.actionsDisabled}
        hasOpponents={hasOpponents}
      />
    </div>
  );
}
