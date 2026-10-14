import * as v from 'valibot';
import { CardSchema, RoyalCardSchema } from './cards.ts';
import { IdentifierSchema } from './identifier.ts';

export const CardsDiscardedForDamageEventSchema = v.strictObject({
  id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  type: v.literal('cardsDiscardedForDamage'),
  playerId: IdentifierSchema,
  cards: v.pipe(v.array(CardSchema), v.minLength(1)),
});
export type CardsDiscardedForDamageEvent = v.InferOutput<typeof CardsDiscardedForDamageEventSchema>;

export const CardsPlayedEventSchema = v.strictObject({
  id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  type: v.literal('cardsPlayed'),
  playerId: IdentifierSchema,
  cards: v.pipe(v.array(CardSchema), v.minLength(1)),
});
export type CardsPlayedEvent = v.InferOutput<typeof CardsPlayedEventSchema>;

export const HeartsRecoveredEventSchema = v.strictObject({
  id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  type: v.literal('heartsRecovered'),
  recoveredCount: v.pipe(v.number(), v.integer(), v.minValue(1)),
});
export type HeartsRecoveredEvent = v.InferOutput<typeof HeartsRecoveredEventSchema>;

export const DiamondCardsDrawnEventSchema = v.strictObject({
  id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  type: v.literal('diamondCardsDrawn'),
  recipientIds: v.pipe(v.array(IdentifierSchema), v.minLength(1)),
});
export type DiamondCardsDrawnEvent = v.InferOutput<typeof DiamondCardsDrawnEventSchema>;

export const EnemyDefeatedEventSchema = v.strictObject({
  id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  type: v.literal('enemyDefeated'),
  playerId: IdentifierSchema,
  enemy: RoyalCardSchema,
  destination: v.picklist(['discard', 'tavern']),
  discardedCards: v.pipe(v.array(CardSchema), v.minLength(1)),
});
export type EnemyDefeatedEvent = v.InferOutput<typeof EnemyDefeatedEventSchema>;

export const GameEventSchema = v.variant('type', [
  CardsDiscardedForDamageEventSchema,
  CardsPlayedEventSchema,
  HeartsRecoveredEventSchema,
  DiamondCardsDrawnEventSchema,
  EnemyDefeatedEventSchema,
]);
export type GameEvent = v.InferOutput<typeof GameEventSchema>;
