import type { GameState } from '../../src/index.ts';

type World = GameState['world'];
type Battle = World['battle'];

type StateOptions = Readonly<{
  players: World['players'];
  currentPlayer: World['currentPlayer'];
  enemy: Battle['enemy'];
  damageDealt?: Battle['damageDealt'];
  playedCards?: Battle['playedCards'];
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
  enemy,
  damageDealt = 0,
  playedCards = [],
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
      battle: { enemy, damageDealt, playedCards, immunityCancelled },
      tavern,
      discard,
      castle,
      rngState,
    },
    decision,
  };
}
