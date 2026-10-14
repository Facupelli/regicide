import type { DomainOutcome } from '@regicide/game-engine';
import type { GameEvent } from '@regicide/protocol';
import { toProtocolCard } from '../protocol/card.ts';

type EventWithoutId = GameEvent extends infer Event
  ? Event extends GameEvent
    ? Omit<Event, 'id'>
    : never
  : never;

export function projectAcceptedActionEvents(
  outcomes: readonly DomainOutcome[],
  playerId: string,
): EventWithoutId[] {
  const events: EventWithoutId[] = [];
  for (const outcome of outcomes) {
    switch (outcome.kind) {
      case 'cards-played':
        events.push({
          type: 'cardsPlayed',
          playerId: outcome.playerId,
          cards: outcome.cards.map(toProtocolCard),
        });
        break;
      case 'hearts-recovered':
        events.push({ type: 'heartsRecovered', recoveredCount: outcome.count });
        break;
      case 'diamonds-drawn':
        events.push({ type: 'diamondCardsDrawn', recipientIds: [...outcome.recipientIds] });
        break;
      case 'damage-discarded':
        events.push({
          type: 'cardsDiscardedForDamage',
          playerId: outcome.playerId,
          cards: outcome.cards.map(toProtocolCard),
        });
        break;
      case 'enemy-defeated':
        events.push({
          type: 'enemyDefeated',
          playerId,
          enemy: toProtocolCard(outcome.enemy),
          destination: outcome.destination,
          discardedCards: outcome.discardedCards.map(toProtocolCard),
        });
        break;
    }
  }
  return events;
}
