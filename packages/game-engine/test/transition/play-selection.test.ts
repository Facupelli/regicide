import assert from 'node:assert/strict';
import { test } from 'node:test';
import { damageDiscardValue, validateCardPlay } from '../../src/index.ts';
import { makeCard, makeRoyal } from '../support/cards.ts';

const animal = { kind: 'animal', id: 'animal-hearts', suit: 'hearts' } as const;
const jester = { kind: 'jester', id: 'jester-1' } as const;

void test('public play validation returns structured results for solo selections', () => {
  const five = makeCard(5, 'clubs');
  const otherFive = makeCard(5, 'hearts');
  const ten = makeCard(10, 'diamonds');
  const otherTen = makeCard(10, 'spades');

  assert.deepEqual(validateCardPlay([]), { kind: 'invalid', reason: 'empty' });
  assert.equal(validateCardPlay([makeCard(8, 'clubs')]).kind, 'valid');
  assert.equal(validateCardPlay([five, otherFive]).kind, 'valid');
  assert.deepEqual(validateCardPlay([ten, otherTen]), {
    kind: 'invalid',
    reason: 'combo-too-large',
  });
  assert.deepEqual(validateCardPlay([five, ten]), {
    kind: 'invalid',
    reason: 'combo-mixed-ranks',
  });
  assert.equal(validateCardPlay([animal, ten]).kind, 'valid');
  assert.equal(
    validateCardPlay([animal, { kind: 'animal', id: 'animal-spades', suit: 'spades' }]).kind,
    'valid',
  );
  assert.deepEqual(validateCardPlay([animal, jester]), {
    kind: 'invalid',
    reason: 'jester-pair',
  });
  assert.deepEqual(validateCardPlay([animal, five, otherFive]), {
    kind: 'invalid',
    reason: 'animal-pair',
  });
  assert.deepEqual(validateCardPlay([five, five]), { kind: 'invalid', reason: 'duplicate' });
});

void test('public damage discard values include Animal Companions and defeated Royals', () => {
  assert.equal(damageDiscardValue(makeCard(8, 'hearts')), 8);
  assert.equal(damageDiscardValue({ kind: 'animal', id: 'animal-clubs', suit: 'clubs' }), 1);
  assert.equal(damageDiscardValue(jester), 0);
  assert.equal(damageDiscardValue(makeRoyal('jack', 'hearts')), 10);
  assert.equal(damageDiscardValue(makeRoyal('queen', 'hearts')), 15);
  assert.equal(damageDiscardValue(makeRoyal('king', 'hearts')), 20);
});
