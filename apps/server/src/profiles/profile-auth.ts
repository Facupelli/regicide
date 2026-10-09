import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getProfileByCredentialHash } from './profile-store.ts';

export function hashProfileToken(profileToken: string): string {
  return createHash('sha256').update('profile:').update(profileToken).digest('hex');
}

export function createProfileToken(): string {
  return randomBytes(32).toString('base64url');
}

export function authenticateProfile(profileToken: string): string | undefined {
  const credentialHash = hashProfileToken(profileToken);
  const profile = getProfileByCredentialHash(credentialHash);
  if (
    !profile ||
    !timingSafeEqual(Buffer.from(profile.credentialHash, 'hex'), Buffer.from(credentialHash, 'hex'))
  )
    return undefined;
  return profile.id;
}
