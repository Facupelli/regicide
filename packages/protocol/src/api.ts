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

export const AddAgentResponseSchema = v.strictObject({
  gameId: IdentifierSchema,
  view: LobbyViewSchema,
});
export type AddAgentResponse = v.InferOutput<typeof AddAgentResponseSchema>;

export const AgentConfigRequestSchema = v.strictObject({
  apiKey: v.pipe(v.string(), v.minLength(1), v.maxLength(4096), v.regex(/^\S+$/)),
  model: v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(200),
    v.regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/),
  ),
  timeoutMs: v.pipe(v.number(), v.integer(), v.minValue(1000), v.maxValue(120000)),
  maxCompletionTokens: v.pipe(v.number(), v.integer(), v.minValue(64), v.maxValue(8192)),
  maxRequests: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(500)),
});
export type AgentConfigRequest = v.InferOutput<typeof AgentConfigRequestSchema>;

export const AgentStatusSchema = v.union([
  v.strictObject({
    state: v.picklist(['unconfigured', 'ready', 'running', 'budget-exhausted']),
    requestsUsed: v.number(),
    maxRequests: v.nullable(v.number()),
  }),
  v.strictObject({
    state: v.literal('failed'),
    reason: v.picklist([
      'authentication',
      'insufficient-credits',
      'rate-limit',
      'provider-error',
      'invalid-request',
      'timeout',
      'cancelled',
      'invalid-response',
      'invalid-action',
      'internal-error',
    ]),
    requestsUsed: v.number(),
    maxRequests: v.nullable(v.number()),
  }),
]);
export type AgentStatus = v.InferOutput<typeof AgentStatusSchema>;
export const AgentStatusResponseSchema = v.strictObject({
  gameId: IdentifierSchema,
  status: AgentStatusSchema,
});
export type AgentStatusResponse = v.InferOutput<typeof AgentStatusResponseSchema>;

export const ApiErrorSchema = v.strictObject({
  error: v.strictObject({
    code: IdentifierSchema,
    message: v.string(),
  }),
});
export type ApiError = v.InferOutput<typeof ApiErrorSchema>;
