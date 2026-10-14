export {
  IllegalActionError,
  battleStats,
  canAcceptDefeat,
  canUseSoloJester,
  canYield,
  damageDiscardValue,
  transition,
  transitionWithOutcome,
  validateCardPlay,
} from './game-engine.ts';
export type { PlayValidation, TransitionOutcome } from './game-engine.ts';
export { setupGame } from './setup.ts';
export { soloVictoryRank } from './solo-victory-rank.ts';
export type { Action, Card, GameState, SoloVictoryRank } from './game-engine.types.ts';
