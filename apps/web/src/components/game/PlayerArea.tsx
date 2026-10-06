import type { GameView, PublicPlayer } from '@regicide/protocol';

export function PlayerSeat({
  player,
  active,
  local = false,
}: {
  player: PublicPlayer;
  active: boolean;
  local?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-wrap items-center justify-center gap-x-2 rounded-lg border px-2 py-1 text-xs transition-colors motion-reduce:transition-none ${active ? 'border-card-selected bg-card-selected/10' : 'border-border bg-panel/60'}`}
      aria-label={`${local ? 'Your seat' : `Player ${player.id}`}, ${player.handSize} cards${active ? ', current player' : ''}`}
    >
      <span className="max-w-24 truncate font-semibold" title={local ? 'You' : player.id}>
        {local ? 'You' : `Player ${player.id}`}
      </span>
      <span className="whitespace-nowrap text-muted-foreground">{player.handSize} cards</span>
      {active && <span className="whitespace-nowrap text-card-selected">Current turn</span>}
    </div>
  );
}

export function PlayerArea({ view }: { view: GameView }) {
  const opponents = view.players.filter((player) => player.id !== view.viewer.id);
  if (!opponents.length) return null;
  const positions =
    opponents.length === 1
      ? ['lg:col-start-2']
      : opponents.length === 2
        ? ['lg:col-start-1', 'lg:col-start-3']
        : ['lg:col-start-1', 'lg:col-start-2', 'lg:col-start-3'];
  return (
    <section
      className="col-span-3 row-start-1 flex gap-2 overflow-x-auto lg:contents"
      aria-label="Other players"
    >
      {opponents.map((player, index) => (
        <div
          key={player.id}
          className={`min-w-28 flex-1 lg:row-start-1 lg:min-w-0 ${positions[index]}`}
        >
          <PlayerSeat
            player={player}
            active={view.status === 'active' && view.currentPlayerId === player.id}
          />
        </div>
      ))}
    </section>
  );
}
