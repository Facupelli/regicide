type LiveSync = 'connecting' | 'ready' | 'awaiting-update' | 'reconnecting-after-submit';
export type VisibleSync = 'connecting' | 'ready' | 'awaiting-update';
export type LiveState = { revision: number; sync: LiveSync };

export function visibleSync(live: LiveState): VisibleSync {
  return live.sync === 'reconnecting-after-submit' ? 'connecting' : live.sync;
}

export function disconnect(live: LiveState): LiveState {
  if (live.sync === 'ready') return { ...live, sync: 'connecting' };
  if (live.sync === 'awaiting-update') return { ...live, sync: 'reconnecting-after-submit' };
  return live;
}

export function receiveSnapshot(live: LiveState, revision: number): LiveState {
  if (revision > live.revision) return { revision, sync: 'ready' };
  if (live.sync === 'connecting') return { ...live, sync: 'ready' };
  if (live.sync === 'reconnecting-after-submit') return { ...live, sync: 'awaiting-update' };
  return live;
}

export function requestAccepted(live: LiveState, submittedAtRevision: number): LiveState {
  // A newer socket view may arrive before the HTTP response; do not start waiting again.
  if (live.revision > submittedAtRevision) return live;
  if (live.sync === 'connecting' || live.sync === 'reconnecting-after-submit') {
    return { ...live, sync: 'reconnecting-after-submit' };
  }
  return { ...live, sync: 'awaiting-update' };
}

export function viewVersion(gameId: string, live: LiveState): string {
  return `${gameId}:${live.revision}`;
}
