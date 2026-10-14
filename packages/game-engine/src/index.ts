export {
  IllegalActionError,
  battleStats,
  canAcceptDefeat,
  canUseSoloJester,
  canYield,
  damageDiscardValue,
  transition,
  transitionWithOutcomes,
  validateCardPlay,
} from './game-engine.ts';
export type { DomainOutcome, PlayValidation, TransitionResult } from './game-engine.ts';
export { setupGame } from './setup.ts';
export { soloVictoryRank } from './solo-victory-rank.ts';
export type { Action, Card, GameState, SoloVictoryRank } from './game-engine.types.ts';
