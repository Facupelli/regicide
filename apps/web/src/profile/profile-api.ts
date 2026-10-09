import {
  CreateProfileResponseSchema,
  ProfileViewSchema,
  type UpdateProfileAiRequest,
} from '@regicide/protocol';
import { request, requestNoContent } from '../api-client.ts';

export function createProfile() {
  return request('/profiles', { method: 'POST' }, CreateProfileResponseSchema);
}

export function getProfile(profileToken: string) {
  return request('/profiles/me', { method: 'GET', bearerToken: profileToken }, ProfileViewSchema);
}

export function updateProfileAi(profileToken: string, settings: UpdateProfileAiRequest) {
  return requestNoContent('/profiles/me/ai', {
    method: 'PUT',
    bearerToken: profileToken,
    body: JSON.stringify(settings),
  });
}

export function revokeProfileAi(profileToken: string) {
  return requestNoContent('/profiles/me/ai', { method: 'DELETE', bearerToken: profileToken });
}
