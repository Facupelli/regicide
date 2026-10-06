import type { GameState } from '../../src/index.ts';

type World = GameState['world'];
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
  decision?: GameState['decision'];
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
}: StateOptions): GameState {
  return {
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
