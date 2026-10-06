import type { Decision, GameState } from '../../src/game-engine.types.ts';

type World = Extract<GameState, { kind: 'active' }>['world'];
type Battle = World['battle'];

type StateOptions = Readonly<{
  players: World['players'];
  currentPlayer: World['currentPlayer'];
  consecutiveYields?: World['consecutiveYields'];
  enemy: Battle['enemy'];
  damageDealt?: Battle['damageDealt'];
  plays?: Battle['plays'];
  immunityCancelled?: Battle['immunityCancelled'];
  tavern?: World['tavern'];
  discard?: World['discard'];
  castle?: World['castle'];
  rngState?: World['rngState'];
  decision?: Decision;
}>;

export function makeGameState({
  players,
  currentPlayer,
  consecutiveYields = 0,
  enemy,
  damageDealt = 0,
  plays = [],
  immunityCancelled = false,
  tavern = [],
  discard = [],
  castle = [],
  rngState = 1,
  decision = { kind: 'await-turn-action' },
}: StateOptions): Extract<GameState, { kind: 'active' }> {
  return {
    kind: 'active',
    world: {
      players,
      currentPlayer,
      consecutiveYields,
      battle: { enemy, damageDealt, plays, immunityCancelled },
      tavern,
      discard,
      castle,
      rngState,
    },
    decision,
  };
}
