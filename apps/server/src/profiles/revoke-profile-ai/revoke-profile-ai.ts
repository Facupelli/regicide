import { getProfile } from '../profile-store.ts';

export function revokeProfileAi(profileId: string): void {
  const profile = getProfile(profileId);
  if (!profile) {
    throw new Error('Authenticated profile missing');
  }
  delete profile.openRouterApiKey;
}
