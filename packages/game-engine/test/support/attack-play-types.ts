import type { AnimalCard, AttackPlay, NumberCard, RoyalCard } from '../../src/game-engine.types.ts';

type Ranked<R extends NumberCard['rank']> = NumberCard & { readonly rank: R };

export function checkAttackPlayShapes(
  number: NumberCard,
  animal: AnimalCard,
  royal: RoyalCard,
  two: Ranked<2>,
  three: Ranked<3>,
  four: Ranked<4>,
  five: Ranked<5>,
  six: Ranked<6>,
): void {
  void ({ kind: 'attack', cards: [number] } satisfies AttackPlay);
  void ({ kind: 'attack', cards: [animal] } satisfies AttackPlay);
  void ({ kind: 'attack', cards: [royal] } satisfies AttackPlay);
  void ({ kind: 'attack', cards: [animal, royal] } satisfies AttackPlay);
  void ({ kind: 'attack', cards: [royal, animal] } satisfies AttackPlay);
  void ({ kind: 'attack', cards: [animal, number] } satisfies AttackPlay);
  void ({ kind: 'attack', cards: [number, animal] } satisfies AttackPlay);
  void ({ kind: 'attack', cards: [animal, animal] } satisfies AttackPlay);
  void ({ kind: 'attack', cards: [two, two] } satisfies AttackPlay);
  void ({ kind: 'attack', cards: [three, three] } satisfies AttackPlay);
  void ({ kind: 'attack', cards: [four, four] } satisfies AttackPlay);
  void ({ kind: 'attack', cards: [five, five] } satisfies AttackPlay);
  void ({ kind: 'attack', cards: [two, two, two] } satisfies AttackPlay);
  void ({ kind: 'attack', cards: [three, three, three] } satisfies AttackPlay);
  void ({ kind: 'attack', cards: [two, two, two, two] } satisfies AttackPlay);

  // @ts-expect-error An attack must have at least one card.
  void ({ kind: 'attack', cards: [] } satisfies AttackPlay);
  // @ts-expect-error Animal pairs cannot contain a third card.
  void ({ kind: 'attack', cards: [animal, animal, animal] } satisfies AttackPlay);
  // @ts-expect-error A numbered combo cannot contain an Animal Companion.
  void ({ kind: 'attack', cards: [two, two, animal] } satisfies AttackPlay);
  // @ts-expect-error Mixed ranks cannot form a combo.
  void ({ kind: 'attack', cards: [two, three] } satisfies AttackPlay);
  // @ts-expect-error Royals cannot form numbered combos.
  void ({ kind: 'attack', cards: [royal, royal] } satisfies AttackPlay);
  // @ts-expect-error Royals cannot combine with numbered cards.
  void ({ kind: 'attack', cards: [royal, two] } satisfies AttackPlay);
  // @ts-expect-error Royals cannot join a numbered combo.
  void ({ kind: 'attack', cards: [two, two, royal] } satisfies AttackPlay);
  // @ts-expect-error A pair of 6s exceeds the combo limit.
  void ({ kind: 'attack', cards: [six, six] } satisfies AttackPlay);
  // @ts-expect-error A triple of 4s exceeds the combo limit.
  void ({ kind: 'attack', cards: [four, four, four] } satisfies AttackPlay);
  // @ts-expect-error A quadruple of 3s exceeds the combo limit.
  void ({ kind: 'attack', cards: [three, three, three, three] } satisfies AttackPlay);
  void ({
    kind: 'attack',
    // @ts-expect-error Numbered combos cannot contain more than four cards.
    cards: [two, two, two, two, two],
  } satisfies AttackPlay);
}
