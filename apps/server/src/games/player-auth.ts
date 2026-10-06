import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { gameStore } from './game-store.ts';
import type { SessionPlayer } from './game-session.ts';

function hashCredential(playerToken: string): Buffer {
  return createHash('sha256').update(playerToken).digest();
}

export function createSessionPlayer(): { player: SessionPlayer; playerToken: string } {
  const playerToken = randomBytes(32).toString('base64url');
  return {
    player: { id: randomUUID(), credentialHash: hashCredential(playerToken).toString('hex') },
    playerToken,
  };
}

export type AuthenticatePlayerResult =
  | { ok: true; playerId: string }
  | { ok: false; reason: 'game-not-found' | 'invalid-credential' };

export function authenticatePlayer({
  gameId,
  playerToken,
}: {
  gameId: string;
  playerToken: string;
}): AuthenticatePlayerResult {
  const session = gameStore.get(gameId);
  if (!session) return { ok: false, reason: 'game-not-found' };

  const credentialHash = hashCredential(playerToken);
  const matchedPlayer = session.players.find((player) =>
    timingSafeEqual(credentialHash, Buffer.from(player.credentialHash, 'hex')),
  );
  return matchedPlayer
    ? { ok: true, playerId: matchedPlayer.id }
    : { ok: false, reason: 'invalid-credential' };
}
