import { damageDiscardValue, validateCardPlay, type PlayValidation } from '@regicide/game-engine';
import type { Card } from '@regicide/protocol';

type InvalidPlayReason = Extract<PlayValidation, { kind: 'invalid' }>['reason'];

const playReasons: Record<InvalidPlayReason, string> = {
  empty: 'Select a card to play.',
  duplicate: 'Select each card only once.',
  'too-many': 'Play at most four cards.',
  'jester-pair': 'A Jester must be played alone.',
  'animal-pair': 'An Animal Companion may pair with only one non-Jester card.',
  'combo-too-large': 'Combo total must be 10 or less.',
  'combo-mixed-ranks': 'Combo cards must have the same number.',
  'unsupported-pair': 'Only numbered cards can form a combo.',
};

export type PlaySelectionState =
  | { kind: 'empty' }
  | { kind: 'valid' }
  | { kind: 'invalid'; reason: string };

export function evaluatePlaySelection(
  hand: readonly Card[],
  selectedCardIds: readonly string[],
): PlaySelectionState {
  if (selectedCardIds.length === 0) return { kind: 'empty' };
  const cards = selectedCardIds.map((id) => hand.find((card) => card.id === id));
  if (!cards.every((card): card is Card => card !== undefined)) {
    return { kind: 'invalid', reason: 'A selected card is no longer in your hand.' };
  }
  const result = validateCardPlay(cards);
  return result.kind === 'valid'
    ? { kind: 'valid' }
    : { kind: 'invalid', reason: playReasons[result.reason] };
}

export function selectedDamageValue(hand: readonly Card[], selectedCardIds: readonly string[]) {
  const ids = new Set(selectedCardIds);
  return hand.reduce((total, card) => total + (ids.has(card.id) ? damageDiscardValue(card) : 0), 0);
}
