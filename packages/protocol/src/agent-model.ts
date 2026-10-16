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

export const AGENT_MODEL_INFO: Record<AgentModelId, { label: string; playerName: string }> = {
  [SUPPORTED_AGENT_MODELS[0]]: { label: 'GPT-6 Luna', playerName: 'GPT-6 Luna' },
  [SUPPORTED_AGENT_MODELS[1]]: { label: 'DeepSeek V4.1 Flash', playerName: 'DeepSeek' },
  [SUPPORTED_AGENT_MODELS[2]]: { label: 'Gemini 3.8 Flash', playerName: 'Gemini 3.8 Flash' },
  [SUPPORTED_AGENT_MODELS[3]]: { label: 'GPT-6 Sol', playerName: 'GPT-6 Sol' },
  [SUPPORTED_AGENT_MODELS[4]]: { label: 'Claude Sonnet 5', playerName: 'Claude Sonnet 5' },
};
