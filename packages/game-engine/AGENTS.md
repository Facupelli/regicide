# Game Engine Development Guardrails

These rules apply when changing `packages/game-engine`.

The engine is being developed incrementally through small TDD slices. Preserve the existing domain model and architectural boundaries unless the current slice provides concrete evidence that they should change.

## 1. Implement only the current slice

Implement only behavior exercised by the current task and its tests.

Do not partially implement adjacent rules because they are nearby, easy to anticipate, or needed for a more general solution.

Unsupported game behavior should remain explicitly unsupported until its own slice is implemented.

## 2. Keep one authoritative representation of each domain fact

Before adding persistent state, check whether the same information already exists or can be derived from more fundamental state.

Avoid duplicated state such as:

- current actor stored in multiple places;
- remaining health stored alongside accumulated damage;
- Spade shield stored alongside played Spades;
- hand limits stored on each player when they are determined by player count.

Derived values should normally remain derived.

## 3. Express domain meaning at abstraction boundaries

Functions should communicate what happened in the game, not how storage should be manipulated.

Prefer:

```text
resolveEnemyDefeat(world, 'exact')
```

over:

```text
resolveEnemyDefeat(world, 'tavern')
```

The receiving abstraction should own the consequences of the domain event.

## 4. Preserve semantic distinctions even when values coincide

Do not reuse a domain operation only because two concepts currently produce the same number or implementation.

For example:

```text
royalCardValue(card)
enemyAttack(enemy)
```

are different domain concepts even if both read the same underlying rank value.

Share underlying data where appropriate, but preserve meaningful domain language in APIs.

## 5. Exhaust closed domain unions at compile time

When branching over a discriminated union such as `Decision`, use exhaustive TypeScript handling.

Adding a new variant should cause a compile-time failure wherever that variant has not been handled.

Prefer an exhaustive `never` check over runtime-only fallback branches.

## 6. Distinguish invalid actions from valid game outcomes

An invalid player action and a valid game outcome are different concepts.

Examples:

```text
wrong player acts
card is not in hand
```

are validation failures.

Examples:

```text
player cannot survive retaliation
final enemy is defeated
```

are valid game outcomes, even if the engine does not model them yet.

Unsupported domain outcomes may temporarily throw while developing slices, but they should be clearly identified as unsupported outcomes rather than invalid actions.

## 7. Test transformations and preservation

When testing a collection transformation, include surrounding unaffected data and assert that it remains intact.

For example, when revealing the next Castle enemy, prefer testing:

```text
[Jack ♦, Queen ♠]
```

becoming:

```text
battle.enemy = Jack ♦
castle = [Queen ♠]
```

rather than using a one-card Castle where accidentally clearing the entire deck would also pass.

Test both what changed and what must not change.

## 8. Encode reusable domain invariants in tests

Scenario tests should also verify relevant global invariants.

Examples include:

```text
every concrete card exists in exactly one zone
input state is not mutated
currentPlayer identifies an existing player
```

Prefer reusable invariant assertions over repeating partial checks in each test.

Add new invariant helpers when repeated engine behavior demonstrates that the invariant is fundamental.

## 9. Generalize only when implemented behavior requires it

Do not introduce frameworks or abstractions solely for known future rules.

Extract a shared concept when multiple implemented behaviors demonstrate that the concept is real.

Examples:

- `attackValue` became justified when Diamond effects needed attack value independently from damage;
- a generic suit-power framework is not justified merely because four suits exist in the rulebook.

Prefer the smallest domain abstraction supported by current behavior.

## 10. Keep orchestration separate from rules

The public `transition` function should describe the state machine.

Conceptually:

```text
transition
→ inspect current decision
→ delegate to decision handler
```

Decision handlers process player intent.

Rule helpers resolve deterministic game consequences.

Avoid allowing `transition` to grow into a large collection of individual game-rule implementations.

## 11. Prefer explicit domain mappings

When a fixed rule maps one domain value to another, prefer an explicitly keyed representation when the key carries domain meaning.

Prefer conceptually:

```text
1 player → hand limit 8
2 players → hand limit 7
3 players → hand limit 6
4 players → hand limit 5
```

over relying on an implicit array offset such as `playerCount - 1`.

Likewise, fixed rank statistics should be represented as typed domain data rather than procedural branching when no behavioral branching exists.

## 12. Functional core does not forbid local imperative code

The engine boundary should be deterministic and immutable from the caller's perspective:

```text
same state + same action → same result
```

and input state must not be mutated.

Inside a pure transformation, local variables, loops, counters, and temporary copied collections are allowed when they make the algorithm clearer.

Do not replace straightforward imperative internals with complicated recursion or chained functional expressions merely to appear more functional.

## Working principle

When uncertain, optimize for:

```text
domain meaning
single source of truth
small tested slices
explicit unsupported boundaries
simple deterministic transformations
```

Do not broaden the engine beyond the behavior required by the current slice.
