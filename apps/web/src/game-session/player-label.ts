import type { PublicPlayer } from '@regicide/protocol';

export function playerLabel(player: Pick<PublicPlayer, 'name' | 'controller'>): string {
  return player.controller === 'human' ? `Player ${player.name}` : player.name;
}

export function playerLabelForId(players: readonly PublicPlayer[], id: string): string {
  const player = players.find((entry) => entry.id === id);
  if (!player) {
    throw new Error('Unknown player in game view');
  }
  return playerLabel(player);
}
