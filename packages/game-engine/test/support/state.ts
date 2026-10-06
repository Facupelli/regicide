import type { Decision, GameState } from '../../src/game-engine.types.ts';

type World = Extract<GameState, { kind: 'active' }>['world'];
type Battle = World['battle'];

type StateOptions = Readonly<{
  players: World['players'];
  currentPlayer: World['currentPlayer'];
  consecutiveYields?: World['consecutiveYields'];
  soloJestersUsed?: World['soloJestersUsed'];
  enemy: Battle['enemy'];
  damageDealt?: Battle['damageDealt'];
  plays?: Battle['plays'];
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
  // Synthetic solo states default to exhausted uses so unrelated rule tests keep automatic retaliation.
  soloJestersUsed = players.length === 1 ? 2 : null,
  enemy,
  damageDealt = 0,
  plays = [],
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
      soloJestersUsed,
      battle: { enemy, damageDealt, plays },
      tavern,
      discard,
      castle,
      rngState,
    },
    decision,
  };
}
