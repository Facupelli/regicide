import * as v from 'valibot';
import { LobbyViewSchema } from './lobby-view.ts';

export const LobbyUpdatedMessageSchema = v.strictObject({
  type: v.literal('lobby-updated'),
  view: LobbyViewSchema,
});
export type LobbyUpdatedMessage = v.InferOutput<typeof LobbyUpdatedMessageSchema>;
