import * as v from 'valibot';
import { GameEventSchema } from './game-event.ts';
import { GameViewSchema } from './game-view.ts';
import { IdentifierSchema } from './identifier.ts';

export const GameUpdatedMessageSchema = v.strictObject({
  type: v.literal('game-updated'),
  revision: v.pipe(v.number(), v.integer(), v.minValue(0)),
  view: GameViewSchema,
  events: v.array(GameEventSchema),
});
export type GameUpdatedMessage = v.InferOutput<typeof GameUpdatedMessageSchema>;

const AgentDecisionMessageFields = {
  revision: v.pipe(v.number(), v.integer(), v.minValue(0)),
  playerId: IdentifierSchema,
};

export const AgentPausedMessageSchema = v.strictObject({
  type: v.literal('agent-paused'),
  ...AgentDecisionMessageFields,
  reason: v.picklist(['failure', 'budget-exhausted', 'unconfigured', 'stopped']),
});
export type AgentPausedMessage = v.InferOutput<typeof AgentPausedMessageSchema>;

export const AgentResumedMessageSchema = v.strictObject({
  type: v.literal('agent-resumed'),
  ...AgentDecisionMessageFields,
});
export type AgentResumedMessage = v.InferOutput<typeof AgentResumedMessageSchema>;
