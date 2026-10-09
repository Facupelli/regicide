import type { GameView, PublicPlayer } from '@regicide/protocol';
import { agentModels } from '../../agents/models.ts';
import { useGamePresentation } from '../presentation/GamePresentationContext.ts';
import { gamePresentationAnchor } from '../presentation/game-presentation.types.ts';

export function PlayerSeat({
  player,
  active,
  local = false,
  elementRef,
}: {
  player: PublicPlayer;
  active: boolean;
  local?: boolean;
  elementRef?: (element: HTMLElement | null) => void;
}) {
  const modelLabel =
    player.controller === 'agent'
      ? (agentModels.find(({ id }) => id === player.model)?.label ?? player.model)
      : null;
  return (
    <div
      ref={elementRef}
      className={`flex min-w-0 flex-wrap items-center justify-center gap-x-2 rounded-lg border px-2 py-1 text-xs transition-colors motion-reduce:transition-none ${active ? 'border-card-selected bg-card-selected/10' : 'border-border bg-panel/60'}`}
      aria-label={`${local ? 'Your seat' : `Player ${player.id}`}${modelLabel ? `, AI, ${modelLabel}` : ''}, ${player.handSize} cards${active ? ', current player' : ''}`}
    >
      <span className="max-w-24 truncate font-semibold" title={local ? 'You' : player.id}>
        {local ? 'You' : `Player ${player.id}`}
      </span>
      {modelLabel && (
        <span className="max-w-full min-w-0 truncate text-card-selected" title={modelLabel}>
          AI · {modelLabel}
        </span>
      )}
      <span
        className="whitespace-nowrap text-muted-foreground"
        data-verify={local ? undefined : 'other-player-hand-count'}
      >
        {player.handSize} cards
      </span>
      {active && <span className="whitespace-nowrap text-card-selected">Current turn</span>}
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
            active={view.status === 'active' && view.currentPlayerId === player.id}
            elementRef={(element) =>
              registerAnchor(gamePresentationAnchor.player(player.id), element)
            }
          />
        </div>
      ))}
    </section>
  );
}
