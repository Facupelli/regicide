import * as v from 'valibot';
import { IdentifierSchema } from './identifier.ts';

export const SuitSchema = v.picklist(['clubs', 'diamonds', 'hearts', 'spades']);
export type Suit = v.InferOutput<typeof SuitSchema>;

export const NumberRankSchema = v.picklist([2, 3, 4, 5, 6, 7, 8, 9, 10]);
export type NumberRank = v.InferOutput<typeof NumberRankSchema>;

export const EnemyRankSchema = v.picklist(['jack', 'queen', 'king']);
export type EnemyRank = v.InferOutput<typeof EnemyRankSchema>;

export const NumberCardSchema = v.strictObject({
  kind: v.literal('number'),
  id: IdentifierSchema,
  rank: NumberRankSchema,
  suit: SuitSchema,
});
export type NumberCard = v.InferOutput<typeof NumberCardSchema>;

export const AnimalCardSchema = v.strictObject({
  kind: v.literal('animal'),
  id: IdentifierSchema,
  suit: SuitSchema,
});
export type AnimalCard = v.InferOutput<typeof AnimalCardSchema>;

export const RoyalCardSchema = v.strictObject({
  kind: v.literal('royal'),
  id: IdentifierSchema,
  rank: EnemyRankSchema,
  suit: SuitSchema,
});
export type RoyalCard = v.InferOutput<typeof RoyalCardSchema>;

export const JesterCardSchema = v.strictObject({
  kind: v.literal('jester'),
  id: IdentifierSchema,
});
export type JesterCard = v.InferOutput<typeof JesterCardSchema>;

export const AttackCardSchema = v.variant('kind', [
  NumberCardSchema,
  AnimalCardSchema,
  RoyalCardSchema,
]);

export const CardSchema = v.variant('kind', [
  NumberCardSchema,
  AnimalCardSchema,
  RoyalCardSchema,
  JesterCardSchema,
]);
export type Card = v.InferOutput<typeof CardSchema>;
