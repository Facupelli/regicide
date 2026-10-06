import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { decode } from '@toon-format/toon';
import {
  attempt,
  current,
  DivergenceError,
  exportReproduction,
  replay,
  start,
} from '../src/driver.ts';
import { diff } from '../src/diff.ts';

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
function command(dir: string, ...args: string[]) {
  const process = spawnSync(processExec, ['--experimental-strip-types', cli, ...args], {
    encoding: 'utf8',
    env: { ...globalThis.process.env, REGICIDE_SESSION_DIR: dir },
  });
  assert.equal(process.stderr, '', `Unexpected stderr: ${process.stderr}`);
  return {
    code: process.status,
    output: (args.includes('--full') && args[0] === 'snapshot'
      ? JSON.parse(process.stdout)
      : decode(process.stdout)) as Record<string, any>,
    stdout: process.stdout,
  };
}
const processExec = process.execPath;
function temporary(fn: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'regicide-cli-'));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

void test('real driver journals accepted and rejected actions and replays exact snapshots', () => {
  const session = start({ playerIds: ['alice'], rngState: 42 });
  const initial = JSON.stringify(current(session));
  const rejected = attempt(session, { kind: 'play-cards', playerId: 'alice', cardIds: ['absent'] });
  assert.equal(rejected.outcome, 'rejected');
  assert.equal(session.snapshots.length, 1);
  assert.equal(JSON.stringify(current(session)), initial);
  const accepted = attempt(session, { kind: 'use-solo-jester', playerId: 'alice' });
  assert.equal(accepted.outcome, 'accepted');
  assert.equal(session.snapshots.length, 2);
  assert.equal(JSON.stringify(session.snapshots[0]), initial);
  const reproduction = exportReproduction(session);
  assert.deepEqual(replay(reproduction), session);
  reproduction.attempts[1] = {
    action: { kind: 'yield', playerId: 'alice' },
    outcome: 'accepted',
    stateHash: '0'.repeat(64),
  };
  assert.throws(
    () => replay(reproduction),
    (error: unknown) => error instanceof DivergenceError && error.sequence === 2,
  );
});

void test('structural diffs report paths, additions and explicit empty results', () => {
  assert.deepEqual(diff({ a: [1, 2], b: null }, { a: [1, 3, 4], c: true }), [
    { path: 'a[1]', before: 2, after: 3 },
    { path: 'a[2]', before: { present: false }, after: 4 },
    { path: 'b', before: null, after: { present: false } },
    { path: 'c', before: { present: false }, after: true },
  ]);
  assert.deepEqual(diff([1], [1]), []);
});

void test('CLI creation, actions, snapshots, trace, diff, export and read-only replay', () =>
  temporary((dir) => {
    assert.equal(command(dir).output.session, 'none');
    assert.equal(command(dir, 'new', '--players', 'alice', '--seed', '42').output.snapshot, 0);
    const snapshot = command(dir, 'snapshot', '--full');
    const state = JSON.parse(snapshot.stdout) as {
      world: { players: { hand: { id: string }[] }[] };
    };
    const card = state.world.players[0]!.hand[0]!.id;
    assert.equal(command(dir, 'play', '--cards', 'absent').output.error.code, 'action-rejected');
    const played = command(dir, 'play', '--cards', card);
    assert.equal(played.code, 0);
    assert.equal(played.output.snapshot, 1);
    assert.equal(command(dir, 'snapshot', '0', '--full').stdout, snapshot.stdout);
    const trace = command(dir, 'trace').output.trace;
    assert.equal(trace.count, 2);
    assert.equal(trace.rejected, 1);
    assert.equal(trace.accepted, 1);
    assert.equal(command(dir, 'diff', '0', '1').output.changes.count > 0, true);
    assert.equal(command(dir, 'diff', '1', '1').output.changes.count, 0);
    const path = join(dir, 'repro.json');
    assert.equal(command(dir, 'export', path).output.attempts, 2);
    assert.equal(command(dir, 'export', path).output.error.code, 'file-exists');
    const before = readFileSync(join(dir, 'game-session.json'), 'utf8');
    assert.equal(command(dir, 'replay', path).output.replay, 'exact');
    assert.equal(readFileSync(join(dir, 'game-session.json'), 'utf8'), before);
    assert.equal(command(dir, 'new', '--players', 'alice,bob,carol,dana', '--seed', '0').code, 0);
    assert.equal(command(dir, 'replay', path, '--activate').output.activated, true);
    assert.equal(readFileSync(join(dir, 'game-session.json'), 'utf8'), before);
    const reproduction = JSON.parse(readFileSync(path, 'utf8')) as {
      attempts: { stateHash?: string }[];
    };
    reproduction.attempts[1]!.stateHash = '0'.repeat(64);
    writeFileSync(path, JSON.stringify(reproduction));
    const diverged = command(dir, 'replay', path, '--activate');
    assert.equal(diverged.code, 1);
    assert.equal(diverged.output.error.code, 'replay-diverged');
    assert.equal(readFileSync(join(dir, 'game-session.json'), 'utf8'), before);
  }));

void test('every action maps to the public engine intention, including rejected attempts', () =>
  temporary((dir) => {
    command(dir, 'new', '--players', 'alice', '--seed', '42');
    for (const [args, kind] of [
      [['play', '--cards', 'bogus'], 'play-cards'],
      [['discard', '--cards', 'bogus'], 'discard-for-damage'],
      [['yield'], 'yield'],
      [['solo-jester'], 'use-solo-jester'],
      [['decline-solo-jester'], 'decline-solo-jester'],
      [['choose-player', '--target', 'alice'], 'choose-next-player'],
    ] as const) {
      const result = command(dir, ...args);
      assert.equal(result.output.action.kind, kind);
    }
    const trace = command(dir, 'trace').output.trace;
    assert.deepEqual(
      trace.entries.map((entry: { action: { kind: string } }) => entry.action.kind),
      [
        'play-cards',
        'discard-for-damage',
        'yield',
        'use-solo-jester',
        'decline-solo-jester',
        'choose-next-player',
      ],
    );
  }));

void test('usage failures and per-command help are structured on stdout with exit 2', () =>
  temporary((dir) => {
    for (const args of [
      ['new'],
      ['new', '--seed', 'NaN', '--players', 'alice'],
      ['play', '--bad'],
      ['trace', 'extra'],
      ['unknown'],
      ['new', '--players', 'alice', '--seed', '42', '--seed', '5'],
    ]) {
      const result = command(dir, ...args);
      assert.equal(result.code, 2, `${args.join(' ')}: ${result.stdout}`);
      assert.equal(result.output.error.code, 'usage');
    }
    for (const name of [
      'new',
      'state',
      'play',
      'discard',
      'yield',
      'solo-jester',
      'decline-solo-jester',
      'choose-player',
      'snapshot',
      'trace',
      'diff',
      'export',
      'replay',
    ]) {
      const result = command(dir, name, '--help');
      assert.equal(result.code, 0);
      assert.equal(result.output.command, name);
      assert.equal(result.output.examples.length >= 2, true);
    }
    assert.equal(command(dir, '--help').output.commands.length > 0, true);
    assert.equal(command(dir, 'diff', 'NaN', '1').code, 2);
    assert.equal(command(dir, 'snapshot').output.error.code, 'no-session');
    assert.equal(
      command(dir, 'new', '--players', 'alice,alice', '--seed', '42').output.error.code,
      'setup-rejected',
    );
    for (const players of ['alice,bob', 'alice,bob,carol']) {
      assert.equal(command(dir, 'new', '--players', players, '--seed', '42').code, 0);
    }
    writeFileSync(join(dir, 'game-session.json'), '{bad json');
    assert.equal(command(dir, 'state').output.error.code, 'invalid-file');
  }));
