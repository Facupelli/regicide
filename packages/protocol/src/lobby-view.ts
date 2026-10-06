import * as v from 'valibot';
import { IdentifierSchema } from './identifier.ts';

export const LobbyViewSchema = v.strictObject({
  status: v.literal('lobby'),
  hostPlayerId: IdentifierSchema,
  players: v.pipe(v.array(v.strictObject({ id: IdentifierSchema })), v.readonly()),
});
export type LobbyView = v.InferOutput<typeof LobbyViewSchema>;
