import type { GameState, SoloVictoryRank, World } from './game-engine.types.ts';

const SOLO_VICTORY_RANK = {
  0: 'gold',
  1: 'silver',
  2: 'bronze',
} as const satisfies Record<Exclude<World['soloJestersUsed'], null>, SoloVictoryRank>;

export function soloVictoryRank(
  wonState: Extract<GameState, { kind: 'game-over'; result: 'win' }>,
): SoloVictoryRank | null {
  const used = wonState.world.soloJestersUsed;
  return used === null ? null : SOLO_VICTORY_RANK[used];
}
