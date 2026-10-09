import { getProfile } from '../profile-store.ts';
import { toProfileView } from '../profile-view.ts';

export function readProfile(profileId: string) {
  const profile = getProfile(profileId);
  if (!profile) {
    throw new Error('Authenticated profile missing');
  }
  return toProfileView(profile);
}
