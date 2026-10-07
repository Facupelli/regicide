# Game Engine Guidelines

## Role

`packages/game-engine` owns the rules and state transitions of Regicide.

The canonical rules are in `docs/regicide-rules.md`. Use them as the source of truth for game behavior.

Keep the engine pure and framework-independent. It must not perform transport, persistence, logging, scheduling, UI work, or other external effects.

Game operations should primarily be deterministic transformations of domain data.

## Design

- Model Regicide concepts, not incidental data shapes or implementation mechanics.
- Prefer immutable data and explicit state transitions.
- Use abstraction barriers. Callers should depend on meaningful domain operations and facts, not representation details.
- Strengthen data when important domain knowledge is established. Prefer parse-don't-validate over repeated validation.
- Make important illegal states difficult to represent. Prefer discriminated unions for materially different domain states.
- Keep type complexity proportional to the invariant it protects. Avoid type-system cleverness.
- Prefer derived truth over synchronized copies of the same fact.
- Protect invariants at the narrowest trustworthy boundary. Trusted downstream code should not repeatedly revalidate them.
- Concentrate each rule, invariant, ordering constraint, and representation decision in one authoritative place.
- Prefer deep modules and meaningful domain operations over exported helper choreography.
- Keep important transition outcomes explicit rather than requiring callers to infer them from incidental field changes.
- Prefer locality before reuse. Generalize stable domain concepts, not similar-looking code.
- Introduce seams only for real variation. Do not add speculative ports, adapters, factories, strategies, or dependency injection.
- Prefer explicit domain policy over compressed or clever mechanics.

## Public Interface

Treat every export as a design cost.

Export domain capabilities and meaningful domain types, not implementation inventory.

Keep helpers, intermediate representations, ordering machinery, and decomposition choices private unless callers have a genuine domain reason to depend on them.

## Source Structure

Organize code around Regicide concepts and ownership of rule knowledge.

Avoid generic buckets such as `utils`, `helpers`, `validators`, `managers`, and `services` when a domain concept provides a clearer home.

Do not organize modules merely by turn chronology, file size, or one-file-per-type conventions.

## Testing

Test primarily through meaningful domain interfaces.

Tests should describe Regicide behavior and invariants rather than mirror internal implementation structure.

Internal pure functions may be tested directly when they represent a substantial independent algorithm or domain concept.

## Avoid

- mutable domain entities or class-based DDD ceremony;
- shallow wrappers or layers that only translate equivalent shapes;
- repeated validation of facts already established by a trusted boundary;
- advanced TypeScript machinery whose complexity exceeds the invariant it protects;
- generic card-game framework abstractions;
- exports created only for testing convenience;
- abstractions introduced only to remove trivial duplication;
- refactors that move code without reducing caller knowledge, invariant risk, or change amplification.
