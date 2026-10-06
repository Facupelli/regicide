import * as v from 'valibot';
import { PlayerCommandSchema } from './commands.ts';
import { GameViewSchema } from './game-view.ts';
import { IdentifierSchema } from './identifier.ts';
import { LobbyViewSchema } from './lobby-view.ts';

const PlayerIdentityFields = {
  playerId: IdentifierSchema,
  playerToken: v.pipe(v.string(), v.minLength(1)),
};
export const PlayerIdentitySchema = v.strictObject(PlayerIdentityFields);
export type PlayerIdentity = v.InferOutput<typeof PlayerIdentitySchema>;

const LobbyResponseSchema = v.strictObject({
  gameId: IdentifierSchema,
  ...PlayerIdentityFields,
  view: LobbyViewSchema,
});

export const CreateGameResponseSchema = LobbyResponseSchema;
export type CreateGameResponse = v.InferOutput<typeof CreateGameResponseSchema>;

export const JoinGameResponseSchema = LobbyResponseSchema;
export type JoinGameResponse = v.InferOutput<typeof JoinGameResponseSchema>;

export const GetGameResponseSchema = v.strictObject({
  gameId: IdentifierSchema,
  view: v.union([LobbyViewSchema, GameViewSchema]),
});
export type GetGameResponse = v.InferOutput<typeof GetGameResponseSchema>;

export const StartGameResponseSchema = v.strictObject({
  gameId: IdentifierSchema,
  view: GameViewSchema,
});
export type StartGameResponse = v.InferOutput<typeof StartGameResponseSchema>;

export const SubmitActionRequestSchema = PlayerCommandSchema;
export type SubmitActionRequest = v.InferOutput<typeof SubmitActionRequestSchema>;

export const SubmitActionResponseSchema = StartGameResponseSchema;
export type SubmitActionResponse = v.InferOutput<typeof SubmitActionResponseSchema>;

export const ApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: IdentifierSchema,
    message: v.string(),
  }),
});
export type ApiError = v.InferOutput<typeof ApiErrorSchema>;
