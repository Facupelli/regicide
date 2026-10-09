import * as v from 'valibot';

export const SUPPORTED_AGENT_MODELS = ['openai/gpt-5-mini', 'deepseek/deepseek-v3.2'] as const;
export const AgentModelIdSchema = v.picklist(SUPPORTED_AGENT_MODELS);
export type AgentModelId = v.InferOutput<typeof AgentModelIdSchema>;
