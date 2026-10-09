import type { UpdateProfileAiRequest } from '@regicide/protocol';
import { getProfile } from '../profile-store.ts';

export function updateProfileAi(profileId: string, settings: UpdateProfileAiRequest): void {
  const profile = getProfile(profileId);
  if (!profile) {
    throw new Error('Authenticated profile missing');
  }
  if (settings.apiKey !== undefined) {
    profile.openRouterApiKey = settings.apiKey;
  }
  if (settings.enabledModels !== undefined) {
    profile.enabledModels = [...settings.enabledModels];
  }
}
