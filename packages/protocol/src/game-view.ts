import * as v from 'valibot';
import { AttackCardSchema, CardSchema, JesterCardSchema, RoyalCardSchema } from './cards.ts';
import { IdentifierSchema } from './identifier.ts';

const NonNegativeIntegerSchema = v.pipe(v.number(), v.integer(), v.minValue(0));

export const PublicPlayerSchema = v.strictObject({
  id: IdentifierSchema,
  handSize: NonNegativeIntegerSchema,
});
export type PublicPlayer = v.InferOutput<typeof PublicPlayerSchema>;

export const ViewerSchema = v.strictObject({
  id: IdentifierSchema,
  hand: v.pipe(v.array(CardSchema), v.readonly()),
});
export type Viewer = v.InferOutput<typeof ViewerSchema>;

export const HistoricalPlayViewSchema = v.variant('kind', [
  v.strictObject({
    kind: v.literal('attack'),
    cards: v.pipe(v.array(AttackCardSchema), v.readonly()),
  }),
  v.strictObject({ kind: v.literal('jester'), card: JesterCardSchema }),
]);
export type HistoricalPlayView = v.InferOutput<typeof HistoricalPlayViewSchema>;

export const BattleViewSchema = v.strictObject({
  enemy: RoyalCardSchema,
  damageDealt: NonNegativeIntegerSchema,
  enemyHealth: NonNegativeIntegerSchema,
  enemyAttack: NonNegativeIntegerSchema,
  shield: NonNegativeIntegerSchema,
  immunityCancelled: v.boolean(),
  plays: v.pipe(v.array(HistoricalPlayViewSchema), v.readonly()),
});
export type BattleView = v.InferOutput<typeof BattleViewSchema>;

export const InteractionSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('waiting') }),
  v.strictObject({
    kind: v.literal('turn'),
    canYield: v.boolean(),
    canUseSoloJester: v.boolean(),
  }),
  v.strictObject({ kind: v.literal('damage-discard'), requiredDamage: NonNegativeIntegerSchema }),
  v.strictObject({ kind: v.literal('solo-retaliation'), canUseSoloJester: v.boolean() }),
  v.strictObject({
    kind: v.literal('choose-next-player'),
    eligiblePlayerIds: v.pipe(v.array(IdentifierSchema), v.readonly()),
  }),
]);
export type Interaction = v.InferOutput<typeof InteractionSchema>;

const PublicGameFields = {
  players: v.pipe(v.array(PublicPlayerSchema), v.readonly()),
  viewer: ViewerSchema,
  tavern: v.strictObject({ remainingCards: NonNegativeIntegerSchema }),
  discard: v.strictObject({ cards: v.pipe(v.array(CardSchema), v.readonly()) }),
  castle: v.strictObject({ remainingCards: NonNegativeIntegerSchema }),
  soloJestersRemaining: v.nullable(NonNegativeIntegerSchema),
};

export const ActiveGameViewSchema = v.strictObject({
  status: v.literal('active'),
  ...PublicGameFields,
  currentPlayerId: IdentifierSchema,
  battle: BattleViewSchema,
  interaction: InteractionSchema,
});
export type ActiveGameView = v.InferOutput<typeof ActiveGameViewSchema>;

export const GameOverLossViewSchema = v.strictObject({
  status: v.literal('game-over'),
  result: v.literal('loss'),
  ...PublicGameFields,
  battle: BattleViewSchema,
});
export type GameOverLossView = v.InferOutput<typeof GameOverLossViewSchema>;

export const GameOverWinViewSchema = v.strictObject({
  status: v.literal('game-over'),
  result: v.literal('win'),
  soloVictoryRank: v.nullable(v.picklist(['gold', 'silver', 'bronze'])),
  ...PublicGameFields,
});
export type GameOverWinView = v.InferOutput<typeof GameOverWinViewSchema>;

export const GameViewSchema = v.union([
  ActiveGameViewSchema,
  v.variant('result', [GameOverLossViewSchema, GameOverWinViewSchema]),
]);
export type GameView = v.InferOutput<typeof GameViewSchema>;
