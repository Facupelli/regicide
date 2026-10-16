import * as v from 'valibot';

export const SUPPORTED_AGENT_MODELS = [
  'openai/gpt-6-luna',
  'deepseek/deepseek-v4.1-flash',
  'google/gemini-3.8-flash',
  'openai/gpt-6-sol',
  'anthropic/claude-sonnet-5',
] as const;
export const AgentModelIdSchema = v.picklist(SUPPORTED_AGENT_MODELS);
export type AgentModelId = v.InferOutput<typeof AgentModelIdSchema>;
