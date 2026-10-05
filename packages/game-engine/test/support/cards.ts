import type { Card } from '../../src/index.ts';

type NumberCard = Extract<Card, { kind: 'number' }>;
type RoyalCard = Extract<Card, { kind: 'royal' }>;

const NUMBER_NAMES: Record<NumberCard['rank'], string> = {
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
};

export function makeCard(rank: NumberCard['rank'], suit: NumberCard['suit']): NumberCard {
  return { kind: 'number', id: `${NUMBER_NAMES[rank]}-${suit}`, rank, suit };
}

export function makeRoyal(rank: RoyalCard['rank'], suit: RoyalCard['suit']): RoyalCard {
  return { kind: 'royal', id: `${rank}-${suit}`, rank, suit };
}
