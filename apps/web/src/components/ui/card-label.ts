import type { Card } from '@regicide/protocol';

export function cardLabel(card: Card): string {
  switch (card.kind) {
    case 'number':
    case 'royal':
      return `${card.rank} of ${card.suit}`;
    case 'animal':
      return `Animal Companion of ${card.suit}`;
    case 'jester':
      return 'Jester';
  }
}
