import * as v from 'valibot';
import { CardSchema } from './cards.ts';
import { IdentifierSchema } from './identifier.ts';

export const CardsDiscardedForDamageEventSchema = v.strictObject({
  id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  type: v.literal('cardsDiscardedForDamage'),
  playerId: IdentifierSchema,
  cards: v.pipe(v.array(CardSchema), v.minLength(1)),
});
export type CardsDiscardedForDamageEvent = v.InferOutput<typeof CardsDiscardedForDamageEventSchema>;

export const GameEventSchema = v.variant('type', [CardsDiscardedForDamageEventSchema]);
export type GameEvent = v.InferOutput<typeof GameEventSchema>;
