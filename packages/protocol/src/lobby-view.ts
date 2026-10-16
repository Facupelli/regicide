import * as v from 'valibot';
import { AgentModelIdSchema } from './agent-model.ts';
import { IdentifierSchema } from './identifier.ts';
import { PlayerNameSchema } from './player-name.ts';

export const LobbyViewSchema = v.strictObject({
  status: v.literal('lobby'),
  hostPlayerId: IdentifierSchema,
  players: v.pipe(
    v.array(
      v.variant('controller', [
        v.strictObject({
          id: IdentifierSchema,
          name: PlayerNameSchema,
          controller: v.literal('human'),
        }),
        v.strictObject({
          id: IdentifierSchema,
          name: PlayerNameSchema,
          controller: v.literal('agent'),
          model: AgentModelIdSchema,
        }),
      ]),
    ),
    v.readonly(),
  ),
});
export type LobbyView = v.InferOutput<typeof LobbyViewSchema>;
