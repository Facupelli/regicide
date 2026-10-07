import * as v from 'valibot';
import { GameEventSchema } from './game-event.ts';
import { GameViewSchema } from './game-view.ts';

export const GameUpdatedMessageSchema = v.strictObject({
  type: v.literal('game-updated'),
  revision: v.pipe(v.number(), v.integer(), v.minValue(0)),
  view: GameViewSchema,
  events: v.array(GameEventSchema),
});
export type GameUpdatedMessage = v.InferOutput<typeof GameUpdatedMessageSchema>;
