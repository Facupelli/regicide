import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('./game-state.js', import.meta.url), 'utf8');
const browser = new URL('../../bin/browser', import.meta.url).pathname;

class Element {
  constructor(text = '', attributes = {}) {
    this.innerText = text;
    this.attributes = attributes;
    this.children = [];
  }
  getAttribute(name) {
    return this.attributes[name] ?? null;
  }
  hasAttribute(name) {
    return name in this.attributes;
  }
  querySelectorAll(selector) {
    const attribute = selector.match(/^\[([\w-]+)(?:="([\w-]+)")?\]$/);
    if (!attribute) throw new Error(`Unexpected selector: ${selector}`);
    return this.children.flatMap((child) => [
      ...(child.hasAttribute(attribute[1]) &&
      (attribute[2] === undefined || child.getAttribute(attribute[1]) === attribute[2])
        ? [child]
        : []),
      ...child.querySelectorAll(selector),
    ]);
  }
}
class Button extends Element {
  constructor(label, selected = false, disabled = false, unavailable = false) {
    super('', {
      'data-verify': 'hand-card',
      'aria-label': label,
      'aria-pressed': String(selected),
      'aria-disabled': String(unavailable || disabled),
    });
    this.disabled = disabled;
  }
}

function fixture({
  phase = 'discard',
  decision = 'Select cards to discard.',
  damage = true,
  zeroDamage = false,
} = {}) {
  const game = new Element('', {
    'data-verify': 'game',
    'data-phase': phase,
    'data-turn': 'you',
  });
  const add = (name, text) => {
    game.children.push(new Element(text, { 'data-verify': name }));
  };
  add('decision', decision);
  if (zeroDamage) {
    add('zero-damage', decision);
  }
  add('enemy-health', '4 / 20');
  game.children.push(
    new Element('', {
      'data-verify': 'enemy-card',
      role: 'img',
      'aria-label': 'queen of spades',
    }),
  );
  const playArea = new Element('', { 'data-verify': 'current-play' });
  playArea.children.push(
    new Element('', {
      'data-verify': 'current-play-card',
      role: 'img',
      'aria-label': '9 of diamonds',
    }),
    new Element('', {
      'data-verify': 'current-play-card',
      role: 'img',
      'aria-label': 'Jester',
    }),
  );
  game.children.push(playArea);
  const players = new Element('', { 'data-verify': 'other-players' });
  const seat = new Element('', { 'aria-label': 'Player abc, 5 cards' });
  seat.children.push(new Element('5 cards', { 'data-verify': 'other-player-hand-count' }));
  players.children.push(seat);
  game.children.push(players);
  add('enemy-attack', '10');
  add('enemy-shield', '8');
  if (damage) {
    add('selected-damage', '0');
    add('required-damage', '2');
  }
  game.children.push(new Button('9 of diamonds'));
  game.children.push(
    new Button('3 of diamonds, unavailable: incompatible play', true, false, true),
  );
  return game;
}

function extract(game) {
  const document = { querySelector: () => game };
  return runInNewContext(`${source.replace('export default ', '')}\ngameState()`, {
    document,
    HTMLButtonElement: Button,
  });
}

test('extracts rendered active discard state, including unavailable cards', () => {
  const state = JSON.parse(JSON.stringify(extract(fixture())));
  assert.deepEqual(state, {
    phase: 'discard',
    turn: 'you',
    decision: 'Select cards to discard.',
    enemy: { card: 'queen of spades', health: 4, attack: 10, shield: 8 },
    hand: [
      { card: '9 of diamonds', selected: false, disabled: false },
      { card: '3 of diamonds', selected: true, disabled: true },
    ],
    damage: { selected: 0, required: 2 },
    currentPlay: ['9 of diamonds', 'Jester'],
    otherPlayers: [{ handCount: 5 }],
  });
});

test('supports non-button cards and absent damage outside discard', () => {
  const game = fixture({
    phase: 'waiting',
    decision: 'Waiting for another player.',
    damage: false,
  });
  game.attributes['data-turn'] = 'other';
  game.children = game.children.filter(
    (child) => child.getAttribute('data-verify') !== 'hand-card',
  );
  game.children.push(new Element('', { 'data-verify': 'hand-card', 'aria-label': 'Jester' }));
  const state = extract(game);
  assert.equal(state.hand[0].disabled, true);
  assert.equal(state.hand[0].selected, false);
  assert.equal(state.damage.selected, null);
  assert.equal(state.damage.required, null);
  game.querySelectorAll('[data-verify="current-play"]')[0].children = [];
  game.querySelectorAll('[data-verify="other-players"]')[0].children = [];
  const emptyState = extract(game);
  assert.equal(emptyState.currentPlay.length, 0);
  assert.equal(emptyState.otherPlayers.length, 0);
});

test('reads multiple visible opponents and a played royal', () => {
  const game = fixture({ phase: 'play', damage: false });
  game.querySelectorAll('[data-verify="current-play-card"]')[0].attributes['aria-label'] =
    'jack of hearts';
  const players = game.querySelectorAll('[data-verify="other-players"]')[0];
  const seat = new Element('', { 'aria-label': 'Player def, 0 cards' });
  seat.children.push(new Element('0 cards', { 'data-verify': 'other-player-hand-count' }));
  players.children.push(seat);
  const state = extract(game);
  assert.equal(state.currentPlay[0], 'jack of hearts');
  assert.deepEqual(JSON.parse(JSON.stringify(state.otherPlayers)), [
    { handCount: 5 },
    { handCount: 0 },
  ]);
});

test('allows a rendered zero-damage discard regardless of decision wording', () => {
  const state = extract(
    fixture({
      decision: "You don't need to discard any cards.",
      damage: false,
      zeroDamage: true,
    }),
  );
  assert.equal(state.decision, "You don't need to discard any cards.");
  assert.equal(state.damage.selected, null);
  assert.equal(state.damage.required, null);
});

test('rejects incomplete, absent, duplicate, and conflicting discard hooks', () => {
  const incomplete = fixture();
  incomplete.children = incomplete.children.filter(
    (child) => child.getAttribute('data-verify') !== 'required-damage',
  );
  assert.throws(() => extract(incomplete), /GAME_STATE_CONTRACT_BROKEN: incomplete damage values/);

  const absent = fixture({ damage: false });
  assert.throws(() => extract(absent), /GAME_STATE_CONTRACT_BROKEN: missing damage values/);

  const duplicate = fixture();
  duplicate.children.push(new Element('1', { 'data-verify': 'required-damage' }));
  duplicate.children.push(new Element('0', { 'data-verify': 'selected-damage' }));
  assert.throws(() => extract(duplicate), /GAME_STATE_CONTRACT_BROKEN: duplicate damage values/);

  const conflicting = fixture({ zeroDamage: true });
  assert.throws(
    () => extract(conflicting),
    /GAME_STATE_CONTRACT_BROKEN: conflicting damage values/,
  );

  const duplicateZero = fixture({ damage: false, zeroDamage: true });
  duplicateZero.children.push(new Element('No discard.', { 'data-verify': 'zero-damage' }));
  assert.throws(() => extract(duplicateZero), /GAME_STATE_CONTRACT_BROKEN: duplicate zero-damage/);
});

test('rejects missing and invalid enemy, play and opponent hooks', () => {
  const missingEnemy = fixture();
  missingEnemy.querySelectorAll('[data-verify="enemy-card"]')[0].attributes['data-verify'] =
    'removed';
  assert.throws(() => extract(missingEnemy), /GAME_STATE_CONTRACT_BROKEN: missing enemy-card/);

  const invalidEnemy = fixture();
  invalidEnemy.querySelectorAll('[data-verify="enemy-card"]')[0].attributes['aria-label'] =
    'garbage';
  assert.throws(
    () => extract(invalidEnemy),
    /GAME_STATE_CONTRACT_BROKEN: invalid enemy-card label/,
  );

  const missingPlayArea = fixture();
  missingPlayArea.querySelectorAll('[data-verify="current-play"]')[0].attributes['data-verify'] =
    'removed';
  assert.throws(() => extract(missingPlayArea), /GAME_STATE_CONTRACT_BROKEN: missing current-play/);

  const missingPlayCard = fixture();
  missingPlayCard.querySelectorAll('[data-verify="current-play-card"]')[0].attributes[
    'data-verify'
  ] = 'removed';
  assert.throws(
    () => extract(missingPlayCard),
    /GAME_STATE_CONTRACT_BROKEN: missing or invalid current-play-card/,
  );

  const invalidPlayCard = fixture();
  invalidPlayCard.querySelectorAll('[data-verify="current-play-card"]')[0].attributes[
    'aria-label'
  ] = '';
  assert.throws(
    () => extract(invalidPlayCard),
    /GAME_STATE_CONTRACT_BROKEN: invalid current-play-card label/,
  );

  const missingPlayers = fixture();
  missingPlayers.querySelectorAll('[data-verify="other-players"]')[0].attributes['data-verify'] =
    'removed';
  assert.throws(() => extract(missingPlayers), /GAME_STATE_CONTRACT_BROKEN: missing other-players/);

  const missingCount = fixture();
  missingCount.querySelectorAll('[data-verify="other-player-hand-count"]')[0].attributes[
    'data-verify'
  ] = 'removed';
  assert.throws(
    () => extract(missingCount),
    /GAME_STATE_CONTRACT_BROKEN: missing other-player-hand-count/,
  );

  const invalidCount = fixture();
  invalidCount.querySelectorAll('[data-verify="other-player-hand-count"]')[0].innerText =
    'five cards';
  assert.throws(
    () => extract(invalidCount),
    /GAME_STATE_CONTRACT_BROKEN: invalid other-player-hand-count/,
  );

  const duplicateCount = fixture();
  const seat = duplicateCount
    .querySelectorAll('[aria-label]')
    .find((element) => element.getAttribute('aria-label').startsWith('Player '));
  seat.children.push(new Element('5 cards', { 'data-verify': 'other-player-hand-count' }));
  assert.throws(
    () => extract(duplicateCount),
    /GAME_STATE_CONTRACT_BROKEN: duplicate other-player-hand-count/,
  );
});

test('distinguishes absent, terminal, and broken gameplay', () => {
  assert.throws(() => extract(null), /GAME_STATE_UNAVAILABLE/);
  for (const phase of ['victory', 'defeat']) {
    assert.throws(
      () => extract(fixture({ phase })),
      new RegExp(`GAME_STATE_UNSUPPORTED: ${phase}`),
    );
  }
  const game = fixture();
  game.children = game.children.filter(
    (child) => child.getAttribute('data-verify') !== 'enemy-health',
  );
  assert.throws(() => extract(game), /GAME_STATE_CONTRACT_BROKEN: missing enemy-health/);
});

test('wrapper preserves AXI session, returns JSON and fails on eval errors', () => {
  const dir = mkdtempSync(join(tmpdir(), 'regicide-browser-test-'));
  const fakePnpm = join(dir, 'pnpm');
  const expected = JSON.parse(JSON.stringify(extract(fixture())));
  try {
    writeFileSync(
      fakePnpm,
      `#!/usr/bin/env bash
if [[ "$2" != "chrome-devtools-axi" || "$3" != "eval" || "$4" != "--full" ]]; then exit 3; fi
if [[ "$5" != *'GAME_STATE_UNAVAILABLE'* ]]; then exit 4; fi
if [[ "$CHROME_DEVTOOLS_AXI_SESSION" != "regicide-test" ]]; then exit 5; fi
if [[ "\${FAIL:-}" == "1" ]]; then
  printf 'error: "GAME_STATE_UNSUPPORTED: defeat"\\n'
  exit 1
fi
if [[ "\${FAIL:-}" == "2" ]]; then
  printf 'unexpected AXI response\\n'
  exit 0
fi
if [[ "\${FAIL:-}" == "3" ]]; then
  printf 'error: "GAME_STATE_CONTRACT_BROKEN: missing enemy-card"\\n'
  exit 1
fi
printf 'result: %s\\n' '${JSON.stringify(JSON.stringify(expected))}'
`,
    );
    chmodSync(fakePnpm, 0o755);
    const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, PI_SESSION_ID: 'test' };
    // Use an explicit result to exercise the actual wrapper and output parser.
    const success = spawnSync(browser, ['game-state'], { env, encoding: 'utf8' });
    assert.equal(success.status, 0, success.stderr);
    assert.deepEqual(JSON.parse(success.stdout), expected);
    const failure = spawnSync(browser, ['game-state'], {
      env: { ...env, FAIL: '1' },
      encoding: 'utf8',
    });
    assert.notEqual(failure.status, 0);
    assert.match(failure.stderr, /GAME_STATE_UNSUPPORTED: defeat/);
    const broken = spawnSync(browser, ['game-state'], {
      env: { ...env, FAIL: '3' },
      encoding: 'utf8',
    });
    assert.notEqual(broken.status, 0);
    assert.match(broken.stderr, /GAME_STATE_CONTRACT_BROKEN: missing enemy-card/);
    const malformed = spawnSync(browser, ['game-state'], {
      env: { ...env, FAIL: '2' },
      encoding: 'utf8',
    });
    assert.notEqual(malformed.status, 0);
    assert.match(malformed.stderr, /GAME_STATE_PROTOCOL_ERROR: AXI eval returned no result/);
    const passthrough = spawnSync(browser, ['--help'], { env, encoding: 'utf8' });
    assert.equal(passthrough.status, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
