import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Action, Card, GameState } from '@regicide/game-engine';
import type { Reproduction, Session, Setup } from './driver.ts';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const sessionDir = process.env.REGICIDE_SESSION_DIR ?? join(repoRoot, '.regicide');
export const sessionPath = join(sessionDir, 'game-session.json');

export class StorageError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function setupOf(value: unknown): value is Setup {
  return (
    record(value) &&
    Array.isArray(value.playerIds) &&
    value.playerIds.every((id: unknown) => typeof id === 'string') &&
    typeof value.rngState === 'number' &&
    Number.isInteger(value.rngState) &&
    value.rngState >= 0 &&
    value.rngState <= 0xffffffff
  );
}

function actionOf(value: unknown): value is Action {
  if (!record(value) || typeof value.playerId !== 'string') return false;
  switch (value.kind) {
    case 'play-cards':
    case 'discard-for-damage':
      return (
        Array.isArray(value.cardIds) && value.cardIds.every((id: unknown) => typeof id === 'string')
      );
    case 'choose-next-player':
      return typeof value.targetPlayerId === 'string';
    case 'yield':
    case 'use-solo-jester':
    case 'decline-solo-jester':
      return true;
    default:
      return false;
  }
}

type World = Extract<GameState, { kind: 'active' }>['world'];
type ResolvedWorld = Extract<GameState, { kind: 'game-over'; result: 'win' }>['world'];
type Battle = World['battle'];
type Decision = Extract<GameState, { kind: 'active' }>['decision'];
type Player = World['players'][number];
type RoyalCard = Extract<Card, { kind: 'royal' }>;

function suitOf(value: unknown): value is RoyalCard['suit'] {
  return value === 'clubs' || value === 'diamonds' || value === 'hearts' || value === 'spades';
}

function royalCardOf(value: unknown): value is RoyalCard {
  return (
    record(value) &&
    value.kind === 'royal' &&
    typeof value.id === 'string' &&
    (value.rank === 'jack' || value.rank === 'queen' || value.rank === 'king') &&
    suitOf(value.suit)
  );
}

function cardOf(value: unknown): value is Card {
  if (!record(value) || typeof value.id !== 'string') return false;
  switch (value.kind) {
    case 'number':
      return (
        typeof value.rank === 'number' &&
        Number.isInteger(value.rank) &&
        value.rank >= 2 &&
        value.rank <= 10 &&
        suitOf(value.suit)
      );
    case 'animal':
      return suitOf(value.suit);
    case 'royal':
      return royalCardOf(value);
    case 'jester':
      return true;
    default:
      return false;
  }
}

function playerOf(value: unknown): value is Player {
  return (
    record(value) &&
    typeof value.id === 'string' &&
    Array.isArray(value.hand) &&
    value.hand.every(cardOf)
  );
}

function playOf(value: unknown): value is Battle['plays'][number] {
  if (!record(value)) return false;
  if (value.kind === 'jester') {
    return record(value.card) && value.card.kind === 'jester' && cardOf(value.card);
  }
  return (
    value.kind === 'attack' &&
    Array.isArray(value.cards) &&
    value.cards.length >= 1 &&
    value.cards.length <= 4 &&
    value.cards.every((card: unknown) => record(card) && card.kind !== 'jester' && cardOf(card))
  );
}

function battleOf(value: unknown): value is Battle {
  return (
    record(value) &&
    royalCardOf(value.enemy) &&
    typeof value.damageDealt === 'number' &&
    Number.isFinite(value.damageDealt) &&
    Array.isArray(value.plays) &&
    value.plays.every(playOf) &&
    typeof value.immunityCancelled === 'boolean'
  );
}

function decisionOf(value: unknown): value is Decision {
  if (!record(value)) return false;
  switch (value.kind) {
    case 'await-turn-action':
    case 'await-next-player-choice':
    case 'await-solo-retaliation':
      return true;
    case 'await-damage-discard':
      return typeof value.requiredDamage === 'number' && Number.isFinite(value.requiredDamage);
    default:
      return false;
  }
}

function worldFieldsOf(value: unknown): value is ResolvedWorld & Record<string, unknown> {
  return (
    record(value) &&
    Array.isArray(value.players) &&
    value.players.every(playerOf) &&
    typeof value.currentPlayer === 'string' &&
    typeof value.consecutiveYields === 'number' &&
    Number.isFinite(value.consecutiveYields) &&
    (value.soloJestersUsed === null ||
      value.soloJestersUsed === 0 ||
      value.soloJestersUsed === 1 ||
      value.soloJestersUsed === 2) &&
    Array.isArray(value.tavern) &&
    value.tavern.every(cardOf) &&
    Array.isArray(value.discard) &&
    value.discard.every(cardOf) &&
    Array.isArray(value.castle) &&
    value.castle.every(royalCardOf) &&
    typeof value.rngState === 'number' &&
    Number.isInteger(value.rngState) &&
    value.rngState >= 0 &&
    value.rngState <= 0xffffffff
  );
}

function worldOf(value: unknown): value is World {
  return worldFieldsOf(value) && record(value) && battleOf(value.battle);
}

function resolvedWorldOf(value: unknown): value is ResolvedWorld {
  return worldFieldsOf(value) && record(value) && !Object.hasOwn(value, 'battle');
}

function stateOf(value: unknown): value is GameState {
  if (!record(value)) return false;
  if (value.kind === 'active') {
    return !Object.hasOwn(value, 'result') && worldOf(value.world) && decisionOf(value.decision);
  }
  if (value.kind !== 'game-over' || Object.hasOwn(value, 'decision')) return false;
  if (value.result === 'loss') return worldOf(value.world);
  if (value.result === 'win') return resolvedWorldOf(value.world);
  return false;
}

function parseJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    if (record(error) && error.code === 'ENOENT') {
      throw new StorageError('file-not-found', `File not found: ${path}`);
    }
    throw new StorageError('invalid-file', `Cannot read JSON at ${path}: ${String(error)}`);
  }
}

function assertSession(raw: unknown): asserts raw is Session {
  if (
    !record(raw) ||
    raw.version !== 1 ||
    !setupOf(raw.setup) ||
    !Array.isArray(raw.snapshots) ||
    !Array.isArray(raw.entries) ||
    raw.snapshots.length === 0 ||
    !raw.snapshots.every(stateOf)
  ) {
    throw new StorageError(
      'invalid-session',
      'Session has an unsupported version or malformed setup/snapshots',
    );
  }
  let snapshot = 0;
  for (const [index, entry] of raw.entries.entries()) {
    if (!record(entry) || entry.sequence !== index + 1 || !actionOf(entry.action)) {
      throw new StorageError('invalid-session', `Malformed action at sequence ${index + 1}`);
    }
    if (entry.outcome === 'accepted' && entry.snapshotAfter === snapshot + 1) {
      snapshot++;
      continue;
    }
    if (entry.outcome === 'rejected' && typeof entry.error === 'string') continue;
    throw new StorageError('invalid-session', `Malformed outcome at sequence ${index + 1}`);
  }
  if (raw.snapshots.length !== snapshot + 1) {
    throw new StorageError(
      'invalid-session',
      'Session snapshot count does not match accepted entries',
    );
  }
}

export function loadSession(): Session | null {
  let raw: unknown;
  try {
    raw = parseJson(sessionPath);
  } catch (error) {
    if (error instanceof StorageError && error.code === 'file-not-found') return null;
    throw error;
  }
  assertSession(raw);
  return raw;
}

function assertReproduction(raw: unknown, path: string): asserts raw is Reproduction {
  if (
    !record(raw) ||
    raw.version !== 1 ||
    !setupOf(raw.setup) ||
    typeof raw.initialHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(raw.initialHash) ||
    !Array.isArray(raw.attempts) ||
    !raw.attempts.every(
      (item: unknown) =>
        record(item) &&
        actionOf(item.action) &&
        ((item.outcome === 'accepted' &&
          typeof item.stateHash === 'string' &&
          /^[a-f0-9]{64}$/.test(item.stateHash)) ||
          (item.outcome === 'rejected' && typeof item.error === 'string')),
    )
  ) {
    throw new StorageError(
      'invalid-reproduction',
      `Malformed or unsupported reproduction: ${path}`,
    );
  }
}

export function loadReproduction(path: string): Reproduction {
  const raw = parseJson(resolve(path));
  assertReproduction(raw, path);
  return raw;
}

export function withSessionLock<T>(fn: () => T): T {
  mkdirSync(sessionDir, { recursive: true });
  const path = join(sessionDir, 'game-session.lock');
  let fd: number;
  try {
    fd = openSync(path, 'wx');
  } catch (error) {
    if (record(error) && error.code === 'EEXIST') {
      throw new StorageError(
        'session-locked',
        `Session is locked; if no CLI is running, remove ${path}`,
      );
    }
    throw new StorageError('session-lock-failed', `Cannot acquire session lock: ${String(error)}`);
  }
  try {
    return fn();
  } finally {
    closeSync(fd);
    unlinkSync(path);
  }
}

// Call under withSessionLock, after reading the latest session inside the lock.
export function saveSession(session: Session): void {
  const temp = join(sessionDir, `game-session.${process.pid}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temp, `${JSON.stringify(session, null, 2)}\n`, { flag: 'wx' });
    renameSync(temp, sessionPath);
  } catch (error) {
    try {
      unlinkSync(temp);
    } catch {
      /* No temporary file was created. */
    }
    throw new StorageError('session-write-failed', `Cannot save session: ${String(error)}`);
  }
}

export function writeReproduction(path: string, reproduction: Reproduction): void {
  const absolute = resolve(path);
  try {
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, `${JSON.stringify(reproduction, null, 2)}\n`, { flag: 'wx' });
  } catch (error) {
    if (record(error) && error.code === 'EEXIST') {
      throw new StorageError('file-exists', `Refusing to overwrite ${absolute}`);
    }
    throw new StorageError('export-failed', `Cannot export to ${absolute}: ${String(error)}`);
  }
}
