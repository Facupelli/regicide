import { createHash } from 'node:crypto';
import {
  IllegalActionError,
  setupGame,
  transition,
  type Action,
  type GameState,
} from '@regicide/game-engine';

export type Setup = { playerIds: string[]; rngState: number };
export type Entry =
  | { sequence: number; action: Action; outcome: 'accepted'; snapshotAfter: number }
  | { sequence: number; action: Action; outcome: 'rejected'; error: string };
export type Session = {
  version: 1;
  setup: Setup;
  snapshots: GameState[];
  entries: Entry[];
};
export type Reproduction = {
  version: 1;
  setup: Setup;
  initialHash: string;
  attempts: (
    | { action: Action; outcome: 'accepted'; stateHash: string }
    | { action: Action; outcome: 'rejected'; error: string }
  )[];
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([left], [right]) => {
          if (left < right) return -1;
          if (left > right) return 1;
          return 0;
        })
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function stateHash(state: GameState): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(state)))
    .digest('hex');
}

export function start(setup: Setup): Session {
  return { version: 1, setup, snapshots: [setupGame(setup)], entries: [] };
}

export function current(session: Session): GameState {
  return session.snapshots[session.snapshots.length - 1]!;
}

// This is the only function that advances a live session. Illegal actions are evidence, not mutations.
export function attempt(session: Session, action: Action): Entry {
  const sequence = session.entries.length + 1;
  let entry: Entry;
  try {
    // Isolate historical snapshots even if a future engine regression mutates its input before throwing.
    const next = transition(structuredClone(current(session)), action);
    session.snapshots.push(next);
    entry = { sequence, action, outcome: 'accepted', snapshotAfter: session.snapshots.length - 1 };
  } catch (error) {
    if (!(error instanceof IllegalActionError)) throw error;
    // Preserve the engine's rejection message in the journal.
    entry = {
      sequence,
      action,
      outcome: 'rejected',
      error: error.message,
    };
  }
  session.entries.push(entry);
  return entry;
}

export function exportReproduction(session: Session): Reproduction {
  return {
    version: 1,
    setup: session.setup,
    initialHash: stateHash(session.snapshots[0]!),
    attempts: session.entries.map((entry) =>
      entry.outcome === 'accepted'
        ? {
            action: entry.action,
            outcome: 'accepted',
            stateHash: stateHash(session.snapshots[entry.snapshotAfter]!),
          }
        : { action: entry.action, outcome: 'rejected', error: entry.error },
    ),
  };
}

export class DivergenceError extends Error {
  readonly sequence: number;
  constructor(sequence: number, message: string) {
    super(message);
    this.sequence = sequence;
  }
}

export function replay(reproduction: Reproduction): Session {
  let session: Session;
  try {
    session = start(reproduction.setup);
  } catch (error) {
    throw new DivergenceError(
      0,
      `Setup failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (stateHash(current(session)) !== reproduction.initialHash) {
    throw new DivergenceError(0, 'Initial state differs from the exported state');
  }
  for (const [index, expected] of reproduction.attempts.entries()) {
    const actual = attempt(session, expected.action);
    const sequence = index + 1;
    if (actual.outcome !== expected.outcome) {
      throw new DivergenceError(sequence, `Expected ${expected.outcome}, got ${actual.outcome}`);
    }
    if (expected.outcome === 'accepted' && actual.outcome === 'accepted') {
      if (stateHash(current(session)) !== expected.stateHash) {
        throw new DivergenceError(sequence, 'Accepted state differs from the exported state');
      }
    }
  }
  return session;
}
