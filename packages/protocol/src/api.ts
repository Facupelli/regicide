import * as v from 'valibot';
import { PlayerCommandSchema } from './commands.ts';
import { GameViewSchema } from './game-view.ts';
import { IdentifierSchema } from './identifier.ts';

const GameResponseSchema = v.strictObject({
  gameId: IdentifierSchema,
  view: GameViewSchema,
});

export const CreateGameResponseSchema = GameResponseSchema;
export type CreateGameResponse = v.InferOutput<typeof CreateGameResponseSchema>;

export const GetGameResponseSchema = GameResponseSchema;
export type GetGameResponse = v.InferOutput<typeof GetGameResponseSchema>;

export const SubmitActionRequestSchema = PlayerCommandSchema;
export type SubmitActionRequest = v.InferOutput<typeof SubmitActionRequestSchema>;

export const SubmitActionResponseSchema = GameResponseSchema;
export type SubmitActionResponse = v.InferOutput<typeof SubmitActionResponseSchema>;

export const ApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: IdentifierSchema,
    message: v.string(),
  }),
});
export type ApiError = v.InferOutput<typeof ApiErrorSchema>;
