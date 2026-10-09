import { randomUUID } from 'node:crypto';
import type { CreateProfileResponse } from '@regicide/protocol';
import { createProfileToken, hashProfileToken } from '../profile-auth.ts';
import { storeProfile } from '../profile-store.ts';
import { toProfileView } from '../profile-view.ts';

export function createProfile(): CreateProfileResponse {
  const profileToken = createProfileToken();
  const profile = {
    id: randomUUID(),
    credentialHash: hashProfileToken(profileToken),
    enabledModels: [],
  };
  storeProfile(profile);
  return { profileToken, profile: toProfileView(profile) };
}
