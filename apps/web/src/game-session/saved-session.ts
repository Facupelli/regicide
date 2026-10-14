import * as v from 'valibot';

const SavedSessionSchema = v.strictObject({
  gameId: v.pipe(
    v.string(),
    v.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  ),
  playerToken: v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]+$/)),
});
export type SavedSession = v.InferOutput<typeof SavedSessionSchema>;

const key = 'regicide.playerSession';

export function readSavedSession(): SavedSession | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) {
      return null;
    }
    const parsed = v.safeParse(SavedSessionSchema, JSON.parse(raw));
    if (parsed.success) {
      return parsed.output;
    }
    sessionStorage.removeItem(key);
  } catch {
    // Storage can be disabled or contain malformed data. Gameplay can still use memory.
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Storage is unavailable.
    }
  }
  return null;
}

export function saveSession(identity: SavedSession): void {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        gameId: identity.gameId,
        playerToken: identity.playerToken,
      } satisfies SavedSession),
    );
  } catch {
    // The current tab still has its in-memory identity.
  }
}

export function clearSavedSession(identity?: SavedSession): void {
  try {
    const stored = identity ? readSavedSession() : null;
    if (
      !identity ||
      (stored?.gameId === identity.gameId && stored.playerToken === identity.playerToken)
    ) {
      sessionStorage.removeItem(key);
    }
  } catch {
    // Storage is unavailable.
  }
}
