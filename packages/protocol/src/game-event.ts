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
  EnemyDefeatedEventSchema,
]);
export type GameEvent = v.InferOutput<typeof GameEventSchema>;
