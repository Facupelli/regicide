import * as v from 'valibot';
import { IdentifierSchema } from './identifier.ts';

export const PlayerCommandSchema = v.variant('kind', [
  v.strictObject({
    kind: v.literal('play-cards'),
    cardIds: v.pipe(v.array(IdentifierSchema), v.readonly()),
  }),
  v.strictObject({ kind: v.literal('yield') }),
  v.strictObject({
    kind: v.literal('discard-for-damage'),
    cardIds: v.pipe(v.array(IdentifierSchema), v.readonly()),
  }),
  v.strictObject({ kind: v.literal('choose-next-player'), targetPlayerId: IdentifierSchema }),
  v.strictObject({ kind: v.literal('use-solo-jester') }),
  v.strictObject({ kind: v.literal('decline-solo-jester') }),
]);
export type PlayerCommand = v.InferOutput<typeof PlayerCommandSchema>;
