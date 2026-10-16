import { AGENT_MODEL_INFO, SUPPORTED_AGENT_MODELS } from '@regicide/protocol';

export const agentModels = SUPPORTED_AGENT_MODELS.map((id) => ({
  id,
  label: AGENT_MODEL_INFO[id].label,
}));
