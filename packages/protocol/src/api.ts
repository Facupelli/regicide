import * as v from 'valibot';
import { AgentModelIdSchema } from './agent-model.ts';
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

export const AddAgentRequestSchema = v.strictObject({ model: AgentModelIdSchema });
export type AddAgentRequest = v.InferOutput<typeof AddAgentRequestSchema>;

export const AddAgentResponseSchema = v.strictObject({
  gameId: IdentifierSchema,
  view: LobbyViewSchema,
});
export type AddAgentResponse = v.InferOutput<typeof AddAgentResponseSchema>;

export const RemoveAgentResponseSchema = AddAgentResponseSchema;
export type RemoveAgentResponse = v.InferOutput<typeof RemoveAgentResponseSchema>;

export { SUPPORTED_AGENT_MODELS } from './agent-model.ts';
export type { AgentModelId } from './agent-model.ts';

export const OpenRouterApiKeySchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(4096),
  v.regex(/^\S+$/),
);

const RequestBudgetSchema = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(500));
export const UpdateGameAgentSettingsRequestSchema = v.pipe(
  v.strictObject({
    maxRequests: v.optional(RequestBudgetSchema),
    enabled: v.optional(v.boolean()),
  }),
  v.check((settings) => settings.maxRequests !== undefined || settings.enabled !== undefined),
);
export type UpdateGameAgentSettingsRequest = v.InferOutput<
  typeof UpdateGameAgentSettingsRequestSchema
>;

export const ProfileViewSchema = v.strictObject({
  id: IdentifierSchema,
  hasOpenRouterKey: v.boolean(),
  enabledModels: v.array(AgentModelIdSchema),
});
export type ProfileView = v.InferOutput<typeof ProfileViewSchema>;

export const CreateProfileResponseSchema = v.strictObject({
  profileToken: v.pipe(v.string(), v.minLength(1)),
  profile: ProfileViewSchema,
});
export type CreateProfileResponse = v.InferOutput<typeof CreateProfileResponseSchema>;

export const UpdateProfileAiRequestSchema = v.pipe(
  v.strictObject({
    apiKey: v.optional(OpenRouterApiKeySchema),
    enabledModels: v.optional(
      v.pipe(
        v.array(AgentModelIdSchema),
        v.check((models) => new Set(models).size === models.length),
      ),
    ),
  }),
  v.check((settings) => settings.apiKey !== undefined || settings.enabledModels !== undefined),
);
export type UpdateProfileAiRequest = v.InferOutput<typeof UpdateProfileAiRequestSchema>;

const AgentStatusFields = {
  enabled: v.boolean(),
  requestsUsed: v.number(),
  maxRequests: RequestBudgetSchema,
};

export const AgentStatusSchema = v.variant('state', [
  v.strictObject({ state: v.literal('idle'), ...AgentStatusFields }),
  v.strictObject({ state: v.literal('ready'), ...AgentStatusFields }),
  v.strictObject({ state: v.literal('running'), ...AgentStatusFields }),
  v.strictObject({
    state: v.literal('blocked'),
    reason: v.picklist([
      'stopped',
      'missing-profile',
      'missing-key',
      'model-disabled',
      'budget-exhausted',
    ]),
    ...AgentStatusFields,
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
    ...AgentStatusFields,
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
