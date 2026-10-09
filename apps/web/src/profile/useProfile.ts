import { useRef, useState } from 'react';
import type { ProfileView, UpdateProfileAiRequest } from '@regicide/protocol';
import { createProfile, getProfile, revokeProfileAi, updateProfileAi } from './profile-api.ts';

type ProfileSession = { token: string; view: ProfileView };

export function useProfile() {
  const [profile, setProfile] = useState<ProfileSession | null>(null);
  const creating = useRef<Promise<void> | null>(null);

  function ensureProfile(): Promise<void> {
    if (profile) {
      return Promise.resolve();
    }
    if (creating.current) {
      return creating.current;
    }
    const operation = createProfile().then(({ profileToken, profile }) => {
      setProfile({ token: profileToken, view: profile });
    });
    creating.current = operation;
    // Keep a successful creation promise until React has committed the profile state.
    // Old event handlers can then never create a second profile in that interval.
    void operation.catch(() => {
      if (creating.current === operation) {
        creating.current = null;
      }
    });
    return operation;
  }

  async function refresh() {
    if (!profile) {
      throw new Error('Profile unavailable. Reopen AI Settings.');
    }
    const view = await getProfile(profile.token);
    setProfile({ token: profile.token, view });
  }

  async function save(settings: UpdateProfileAiRequest) {
    if (!profile) {
      throw new Error('Profile unavailable. Reopen AI Settings.');
    }
    await updateProfileAi(profile.token, settings);
    await refresh();
  }

  async function revoke() {
    if (!profile) {
      throw new Error('Profile unavailable. Reopen AI Settings.');
    }
    await revokeProfileAi(profile.token);
    await refresh();
  }

  return { profile, ensureProfile, refresh, save, revoke };
}
