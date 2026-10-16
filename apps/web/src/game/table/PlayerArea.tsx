import type { ActiveGameView, GameView, PublicPlayer } from '@regicide/protocol';
import { AGENT_MODEL_INFO } from '@regicide/protocol';
import { playerLabel } from '../../game-session/player-label.ts';
import { useGamePresentation } from '../presentation/GamePresentationContext.ts';
import { gamePresentationAnchor } from '../presentation/game-presentation.types.ts';

const decisionLabels = {
  turn: 'Choosing a play',
  'damage-discard': 'Defending against the enemy',
  'choose-next-player': 'Choosing the next player',
} satisfies Record<ActiveGameView['currentDecision'], string>;

export function PlayerSeat({
  player,
  decision,
  local = false,
  elementRef,
}: {
  player: PublicPlayer;
  decision: ActiveGameView['currentDecision'] | null;
  local?: boolean;
  elementRef?: (element: HTMLElement | null) => void;
}) {
  const active = decision !== null;
  const { displayedHandCounts } = useGamePresentation();
  const handSize = local ? player.handSize : (displayedHandCounts?.[player.id] ?? player.handSize);
  const label = playerLabel(player);
  const modelLabel = player.controller === 'agent' ? AGENT_MODEL_INFO[player.model].label : null;
  return (
    <div
      ref={elementRef}
      className={`flex min-w-0 flex-col items-center justify-center rounded-lg border px-2 py-1 text-xs transition-colors motion-reduce:transition-none ${active ? 'border-card-selected bg-card-selected/10' : 'border-border bg-panel/60'}`}
      aria-label={`${label}${local ? ', your seat' : ''}${modelLabel ? `, model ${modelLabel}` : ''}, ${handSize} cards${decision ? `, current player, ${decisionLabels[decision]}` : ''}`}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-2">
        <span
          className="max-w-full truncate font-semibold"
          title={modelLabel ? `${label} - ${modelLabel}` : label}
        >
          {label}
          {local ? ' (You)' : ''}
        </span>
        <span
          className="whitespace-nowrap text-muted-foreground"
          data-verify={local ? undefined : 'other-player-hand-count'}
        >
          {handSize} cards
        </span>
      </div>
      {decision && (
        <span className="mt-1 w-full text-center text-[11px] leading-tight text-card-selected">
          {decisionLabels[decision]}
        </span>
      )}
    </div>
  );
}

export function PlayerArea({ view }: { view: GameView }) {
  const { registerAnchor } = useGamePresentation();
  const opponents = view.players.filter((player) => player.id !== view.viewer.id);
  if (!opponents.length) {
    return null;
  }
  const positions =
    {
      1: ['lg:col-start-2'],
      2: ['lg:col-start-1', 'lg:col-start-3'],
      3: ['lg:col-start-1', 'lg:col-start-2', 'lg:col-start-3'],
    }[opponents.length] ?? [];
  return (
    <section
      className="col-span-3 row-start-1 flex flex-wrap gap-2 lg:contents"
      aria-label="Other players"
    >
      {opponents.map((player, index) => (
        <div
          key={player.id}
          className={`min-w-0 flex-1 basis-[30%] lg:row-start-1 lg:min-w-0 ${positions[index]}`}
        >
          <PlayerSeat
            player={player}
            decision={
              view.status === 'active' && view.currentPlayerId === player.id
                ? view.currentDecision
                : null
            }
            elementRef={(element) =>
              registerAnchor(gamePresentationAnchor.player(player.id), element)
            }
          />
        </div>
      ))}
    </section>
  );
}
