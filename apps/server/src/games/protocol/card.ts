import type { Card as EngineCard } from '@regicide/game-engine';
import type { Card } from '@regicide/protocol';

export function toProtocolCard(
  card: Extract<EngineCard, { kind: 'royal' }>,
): Extract<Card, { kind: 'royal' }>;
export function toProtocolCard(
  card: Extract<EngineCard, { kind: 'jester' }>,
): Extract<Card, { kind: 'jester' }>;
export function toProtocolCard(
  card: Exclude<EngineCard, { kind: 'jester' }>,
): Exclude<Card, { kind: 'jester' }>;
export function toProtocolCard(card: EngineCard): Card;
export function toProtocolCard(card: EngineCard): Card {
  switch (card.kind) {
    case 'number':
      return { kind: 'number', id: card.id, rank: card.rank, suit: card.suit };
    case 'animal':
      return { kind: 'animal', id: card.id, suit: card.suit };
    case 'royal':
      return { kind: 'royal', id: card.id, rank: card.rank, suit: card.suit };
    case 'jester':
      return { kind: 'jester', id: card.id };
  }
  return assertNever(card);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported engine state: ${JSON.stringify(value)}`);
}
