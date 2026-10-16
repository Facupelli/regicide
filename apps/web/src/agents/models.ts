import { SUPPORTED_AGENT_MODELS, type AgentModelId } from '@regicide/protocol';

const labels: Record<AgentModelId, string> = {
  [SUPPORTED_AGENT_MODELS[0]]: 'GPT-6 Luna',
  [SUPPORTED_AGENT_MODELS[1]]: 'DeepSeek V4.1 Flash',
  [SUPPORTED_AGENT_MODELS[2]]: 'Gemini 3.8 Flash',
  [SUPPORTED_AGENT_MODELS[3]]: 'GPT-6 Sol',
  [SUPPORTED_AGENT_MODELS[4]]: 'Claude Sonnet 5',
};

export const agentModels = SUPPORTED_AGENT_MODELS.map((id) => ({ id, label: labels[id] }));
