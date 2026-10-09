import { SUPPORTED_AGENT_MODELS, type AgentModelId } from '@regicide/protocol';

const labels: Record<AgentModelId, string> = {
  [SUPPORTED_AGENT_MODELS[0]]: 'GPT-5 Mini',
  [SUPPORTED_AGENT_MODELS[1]]: 'DeepSeek V3.2',
};

export const agentModels = SUPPORTED_AGENT_MODELS.map((id) => ({ id, label: labels[id] }));
