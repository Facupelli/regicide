import type { ProfileView } from '@regicide/protocol';
import type { Profile } from './profile-store.ts';

export function toProfileView(profile: Profile): ProfileView {
  return {
    id: profile.id,
    hasOpenRouterKey: profile.openRouterApiKey !== undefined,
    enabledModels: [...profile.enabledModels],
  };
}
