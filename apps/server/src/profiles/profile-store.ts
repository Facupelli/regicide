import type { AgentModelId } from '@regicide/protocol';

export type Profile = {
  id: string;
  credentialHash: string;
  openRouterApiKey?: string;
  enabledModels: AgentModelId[];
};

const profiles = new Map<string, Profile>();
const profileIdsByCredentialHash = new Map<string, string>();

export function storeProfile(profile: Profile): void {
  profiles.set(profile.id, profile);
  profileIdsByCredentialHash.set(profile.credentialHash, profile.id);
}

export function getProfile(profileId: string): Profile | undefined {
  return profiles.get(profileId);
}

export function getProfileByCredentialHash(credentialHash: string): Profile | undefined {
  const profileId = profileIdsByCredentialHash.get(credentialHash);
  return profileId === undefined ? undefined : profiles.get(profileId);
}
