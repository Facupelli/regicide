import {
  AddAgentResponseSchema,
  AgentStatusResponseSchema,
  CreateGameResponseSchema,
  JoinGameResponseSchema,
  RemoveAgentResponseSchema,
  StartGameResponseSchema,
  SubmitActionResponseSchema,
  type AddAgentRequest,
  type AgentModelId,
  type UpdateGameAgentSettingsRequest,
  type PlayerCommand,
} from '@regicide/protocol';
import { request, requestNoContent } from '../api-client.ts';

const gamePath = (gameId: string) => `/games/${encodeURIComponent(gameId)}`;

export function createGame(profileToken?: string) {
  return request(
    '/games',
    { method: 'POST', ...(profileToken ? { bearerToken: profileToken } : {}) },
    CreateGameResponseSchema,
  );
}

export function joinGame(gameId: string) {
  return request(`${gamePath(gameId)}/join`, { method: 'POST' }, JoinGameResponseSchema);
}

export function startGame(gameId: string, playerToken: string) {
  return request(
    `${gamePath(gameId)}/start`,
    { method: 'POST', bearerToken: playerToken },
    StartGameResponseSchema,
  );
}

export function addAgent(gameId: string, playerToken: string, model: AgentModelId) {
  return request(
    `${gamePath(gameId)}/agents`,
    {
      method: 'POST',
      bearerToken: playerToken,
      body: JSON.stringify({ model } satisfies AddAgentRequest),
    },
    AddAgentResponseSchema,
  );
}

export function removeAgent(gameId: string, playerToken: string, agentId: string) {
  return request(
    `${gamePath(gameId)}/agents/${encodeURIComponent(agentId)}`,
    { method: 'DELETE', bearerToken: playerToken },
    RemoveAgentResponseSchema,
  );
}

export function agentStatus(gameId: string, playerToken: string) {
  return request(
    `${gamePath(gameId)}/agent`,
    { method: 'GET', bearerToken: playerToken },
    AgentStatusResponseSchema,
  );
}

export function retryAgent(gameId: string, playerToken: string) {
  return request(
    `${gamePath(gameId)}/agent/retry`,
    { method: 'POST', bearerToken: playerToken },
    AgentStatusResponseSchema,
  );
}

export function updateAgentSettings(
  gameId: string,
  playerToken: string,
  settings: UpdateGameAgentSettingsRequest,
) {
  return requestNoContent(`${gamePath(gameId)}/agent/settings`, {
    method: 'PUT',
    bearerToken: playerToken,
    body: JSON.stringify(settings),
  });
}

export async function createSoloGame() {
  const lobby = await createGame();
  const started = await startGame(lobby.gameId, lobby.playerToken);
  return { ...started, playerId: lobby.playerId, playerToken: lobby.playerToken };
}

export function submitAction(gameId: string, playerToken: string, command: PlayerCommand) {
  return request(
    `${gamePath(gameId)}/actions`,
    { method: 'POST', bearerToken: playerToken, body: JSON.stringify(command) },
    SubmitActionResponseSchema,
  );
}
