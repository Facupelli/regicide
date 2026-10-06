# Design Doctrine

## Purpose

The goal is code that concentrates knowledge, preserves invariants, remains easy to reason about, and exposes a small amount of conceptual surface for a large amount of correct behavior.

---

## 1. Preserve the functional core

Game behavior should be expressed primarily as pure transformations of domain data.

Given the same valid state and the same valid intention, a domain operation should produce the same result without depending on hidden mutable state, I/O, clocks, transport, persistence, or framework lifecycle.

Mutation is not required for rich domain modeling. Domain concepts can be represented by immutable data and domain behavior by functions over that data.

Effects that exist outside the rules of Regicide belong outside the engine. The engine may describe what happened or what is required next, but it should not perform transport, persistence, logging, scheduling, or UI work itself.

Purity is not the end goal by itself. Its value is that domain behavior becomes explicit, deterministic, composable, and locally verifiable.

---

## 2. Model domain concepts, not incidental data shapes

The model should use the language of Regicide.

Names should express domain concepts and distinctions that matter to the rules. A maintainer should encounter concepts such as plays, attacks, enemies, immunity, damage, turn progression, and legal choices rather than structures named after implementation mechanics.

A type or module earns its place when it captures domain meaning, protects a domain rule, hides a representation decision, or provides meaningful leverage to callers.

Do not introduce domain-looking names merely to wrap primitives or rename existing structures. More named types do not automatically produce a better model.

Prefer a representation that makes important distinctions visible. If two states have materially different legal operations or invariants, consider representing that distinction directly instead of encoding it through loosely related flags, nullable fields, or conventions callers must remember.

---

## 3. Build real data abstractions

A domain data abstraction is more than a TypeScript type declaration.

Following SICP's abstraction-barrier principle, code that uses a domain concept should depend on the meaningful operations and facts of that concept, not on accidental details of its representation.

When a representation has invariants or non-obvious construction rules, provide a trusted way to construct or transform it. Code outside that abstraction should not need to recreate those rules.

A representation should be replaceable without forcing unrelated callers to change. If callers must know how fields are arranged, which combinations are valid, or which values must be kept synchronized, that knowledge is part of the effective interface and the abstraction barrier is weak.

Do not hide data mechanically. Plain immutable records are appropriate when their representation is already the simplest truthful model and exposing it does not leak a design decision or weaken an invariant.

Encapsulation exists to hide knowledge that callers should not own, not to imitate object-oriented privacy.

---

## 4. Strengthen data when knowledge is acquired

Validation should not repeatedly rediscover the same fact.

When the engine establishes an important domain fact, prefer producing a representation that carries that fact forward. Downstream code should receive the strongest practical representation justified by what is already known.

This follows the principle commonly expressed as **parse, don't validate**: do not check a weak representation and then continue passing the same weak representation through the system when a stronger domain value can encode the result of that check.

For example, if a domain operation depends on something already having been established as a legal play, the deeper rule-resolution code should not need to independently reconstruct all legality checks from raw cards.

This does not mean every predicate deserves a branded type or wrapper. Strengthen representations when doing so removes meaningful illegal states, repeated checks, ambiguous states, or caller obligations.

The complexity of the type should be proportional to the domain invariant it protects.

---

## 5. Make important illegal states difficult to represent

Use TypeScript's type system to encode stable and meaningful domain distinctions when it makes the model easier to understand.

Discriminated unions are especially valuable when different domain states permit different data or operations. Prefer explicit alternatives over combinations of booleans and optional fields when those combinations create states that the rules do not recognize.

However, “make illegal states unrepresentable” is a direction, not an absolute objective.

Some rules are contextual, temporal, numerical, or dependent on collections in ways that TypeScript cannot express economically. Those rules may remain runtime invariants. What matters is that they have one trusted enforcement point and do not become obligations repeated throughout the engine.

Do not replace straightforward runtime logic with elaborate generic, conditional, recursive, branded, or phantom types unless the reduction in domain uncertainty clearly exceeds the added cognitive cost.

Types should clarify the model, not demonstrate the power of the type system.

---

## 6. Prefer derived truth over synchronized truth

Do not store the same domain fact in multiple representations unless there is a compelling reason.

If a value can be cheaply and reliably derived from authoritative state, prefer deriving it to maintaining another field that can become inconsistent.

When duplicated state is justified, the code responsible for preserving synchronization must be localized behind one abstraction. Callers should not be responsible for updating several fields in the correct combination.

A domain invariant that depends on “remember to update both places” is an information-locality problem.

---

## 7. Use procedures to express domain operations

SICP treats procedures as abstractions over computational processes. Apply the same idea to game behavior.

Functions should allow callers to speak at the level of the domain operation they intend, rather than at the level of the primitive steps used to implement it.

A caller should not need to orchestrate a sequence of low-level helpers when that sequence collectively represents one domain operation and its ordering is part of the rules.

Internal implementation can still be decomposed into small pure functions. The important distinction is between **internal decomposition** and **external conceptual surface**.

Small functions are not automatically good interfaces. A collection of tiny exported helpers can force every caller to understand the same choreography, ordering constraints, and invariants. In that case the implementation is decomposed, but the knowledge is not encapsulated.

Extract common procedural patterns when the abstraction has a clear meaning and removes duplicated knowledge. Do not generalize merely because two pieces of code currently have a similar shape.

An abstraction should name a concept, not just eliminate repeated syntax.

---

## 8. Prefer deep modules

A module should provide substantial domain leverage through a comparatively small interface.

Here, an interface means everything a caller must know to use the module correctly: exported types and functions, but also invariants, ordering requirements, error behavior, and assumptions.

A deep module hides meaningful complexity and knowledge. A shallow module moves code without reducing what callers must understand.

Depth should be evaluated as leverage, not by counting lines. A large implementation can still be shallow, and a small implementation can be deep if it removes a meaningful conceptual burden from every caller.

Use the deletion test as a design intuition: if removing a module makes its supposed complexity disappear rather than reappear in its callers, the module was probably mostly indirection.

Do not optimize for many modules, many files, many interfaces, or small file sizes. Optimize for a small amount of knowledge required at each interface.

---

## 9. Hide design decisions and concentrate knowledge

Parnas's information-hiding principle applies directly to the rules engine: modules should be organized around pieces of knowledge that may change or that must remain internally consistent.

A rule, invariant, ordering constraint, representation decision, or derived calculation should have a clear home.

If the same rule must be understood and reimplemented by several callers, knowledge has leaked even if the code is technically “DRY”.

Prefer one authoritative implementation of a domain decision over several coordinated implementations.

Changes to one domain rule should affect the smallest coherent region of the engine possible. Locality is a primary design property: related knowledge, behavior, and verification should live together.

Do not decompose modules according to the chronological order in which a turn happens merely because the rules are described in steps. Runtime sequence and ownership of domain knowledge are different concerns.

A temporal step can be a useful domain concept, but it should become a module boundary only when it owns coherent knowledge rather than simply occurring before or after another step.

---

## 10. Let modules tell the domain story

DDD's guidance on modules is useful without adopting its object-oriented implementation patterns.

Modules should group concepts that can be understood and reasoned about together. Their names should come from the domain language and help explain the game.

Prefer conceptual cohesion over technical categorization. Avoid organizing the core primarily into generic buckets such as `utils`, `helpers`, `validators`, `managers`, or `services` when stronger domain concepts exist.

A module boundary should reduce the number of concepts a reader must hold in mind at once.

If two pieces of code change together because they embody the same rule or design decision, separating them for stylistic symmetry may reduce locality rather than improve modularity.

Conversely, proximity alone is not cohesion. Code belongs together because it shares domain knowledge, not merely because it participates in the same execution path.

---

## 11. Protect invariants at the narrowest trustworthy boundary

An invariant should be enforced where the engine first has enough information to enforce it reliably.

Do not make every downstream function defensive against states that an upstream trusted operation has already ruled out. That spreads domain knowledge and obscures which states are actually possible.

Likewise, do not rely on distant callers to preserve an invariant that belongs to a domain abstraction.

Construction and transition operations are natural invariant boundaries. Once they return a trusted domain value, internal code should be able to rely on the guarantees of that value.

This trust must be earned. Public or externally reachable inputs remain untrusted until converted into domain-valid representations.

---

## 12. Keep state transitions explicit

The engine should make changes in domain state visible as values.

Prefer operations that receive state and an intention or domain input and return a resulting state or explicit outcome. Important consequences should not be hidden in unrelated mutation.

When a transition can produce materially different domain outcomes, represent those outcomes explicitly rather than requiring callers to infer them from incidental field changes.

State-machine concepts are useful when they reflect real rule distinctions. They should not be introduced merely to force every function into a formal state-machine framework.

The model should make legal progression easier to see and illegal progression harder to express.

---

## 13. Separate legality, resolution, and representation only when the separation carries meaning

Different rule concerns can deserve different abstractions, but avoid ceremonial layering.

A separate legality concept is valuable when successful legality checking produces knowledge that later resolution can trust. It is shallow when it returns only a boolean and forces callers or downstream functions to reconstruct the same reasoning.

A separate representation layer is valuable when it hides a representation decision. It is shallow when it translates between structurally identical shapes without reducing complexity.

A separate rule helper is valuable when it owns a coherent rule. It is shallow when callers still need to understand how to combine several helpers correctly.

Create distinctions that reduce caller knowledge. Do not create layers because an architecture diagram appears cleaner with them.

---

## 14. Introduce seams only for real variation

A seam is useful when behavior genuinely needs to vary behind a stable interface.

Do not introduce ports, adapters, strategies, interfaces, factories, or dependency injection inside the pure engine in anticipation of hypothetical future alternatives.

One implementation is not, by itself, evidence that an interface abstraction is needed.

Pure functions already provide excellent composition and testability. Add an explicit seam when there are real alternatives, a real source of external variability, or a meaningful information-hiding reason.

The engine should not imitate infrastructure architecture patterns that solve problems it does not have.

---

## 15. Treat the public interface as a design cost

Every exported concept becomes something callers may need to learn and something the package may need to preserve.

Export domain capabilities, not implementation inventory.

Internal helpers, intermediate representations, ordering machinery, and decomposition choices should remain private unless callers have a genuine domain reason to depend on them.

A small export surface is not automatically good: an opaque “do everything” function can also be a poor interface. The goal is a compact set of expressive operations and types that expose the right domain concepts while hiding implementation decisions.

The public interface should let a caller accomplish meaningful game operations without reconstructing engine internals.

---

## 16. Test through meaningful interfaces

Tests should normally exercise the same meaningful interfaces used by callers.

If important behavior can only be tested by reaching through a module's interface into its private decomposition, reconsider whether the externally meaningful operation is at the correct level.

Internal pure functions may still deserve direct tests when they encode substantial independent algorithms or domain concepts. Testing internals is not forbidden.

The principle is that refactoring implementation details should not force broad test rewrites when observable domain behavior is unchanged.

Tests are strongest when they describe domain behavior and invariants rather than mirroring implementation structure.

---

## 17. Optimize for locality before reuse

A reusable abstraction is valuable when it captures a stable concept shared by several uses.

Do not sacrifice locality to remove small amounts of duplication.

Two pieces of similar code can be better than one abstraction if the shared abstraction would couple unrelated domain rules, require configuration flags, expose implementation details, or force readers to jump between distant concepts.

Duplication of **knowledge** is dangerous. Duplication of a few simple expressions is not necessarily dangerous.

Prefer the design in which a future rule change has one obvious conceptual home.

---

## 18. Use generality carefully

An abstraction should be general enough to express the domain concept cleanly, but no more general than current understanding justifies.

SICP demonstrates the power of finding general computational patterns, while also warning that programs should operate at the abstraction level appropriate to the task.

Generalize after identifying the stable pattern and the variation it must support.

Do not design an engine framework for hypothetical card games when the domain is Regicide. Do not parameterize a rule merely because a constant could theoretically vary.

Generality is useful when it removes accidental restrictions from a real concept. Speculative flexibility increases the interface and weakens the model.

---

## 19. Prefer explicit domain policy over clever mechanics

The rules engine is knowledge-rich code. Readability of policy is more important than minimizing lines.

Prefer code where a maintainer can connect implementation structure to the rule it expresses.

Avoid compressed expressions, generic combinator chains, meta-programming, or abstraction-heavy pipelines when they make rule ordering or domain consequences harder to see.

Higher-order functions are valuable when they express a genuine reusable operation or policy. They are not inherently more functional or better designed than a direct named function.

The best representation is the one that makes the domain easier to reason about while preserving locality and invariants.

---

## 20. Design tensions should be resolved in favor of reduced knowledge burden

These principles can pull in different directions. Resolve them by asking which design makes fewer domain facts necessary outside their natural home.

**Encapsulation vs. transparent data:** keep plain data transparent when there is no meaningful representation secret; encapsulate when callers would otherwise own invariants or design decisions.

**Small functions vs. deep modules:** freely use small functions internally; do not force callers to compose them when their composition is itself domain knowledge.

**Strong types vs. simple types:** encode important stable distinctions; use runtime enforcement when a type-level encoding costs more understanding than it saves.

**Reuse vs. locality:** prefer locality unless the shared abstraction represents a real common concept.

**Generality vs. domain specificity:** generalize a known pattern, not a hypothetical future.

**Abstraction vs. directness:** introduce an abstraction when it lets the program speak in a meaningful concept or hides knowledge. Otherwise prefer direct code.

**Separation vs. cohesion:** separate independently understandable knowledge; keep behavior together when correctness depends on the same invariant or design decision.

---

## Anti-goals

The engine should not drift toward any of the following merely in the name of architecture:

- class-based DDD or mutable domain entities;
- anemic objects whose only purpose is to wrap data;
- repositories, ports, adapters, services, factories, or interfaces without real variation;
- one-file-per-type or one-function-per-module ceremony;
- layers that translate between equivalent shapes;
- pass-through wrappers that do not hide knowledge;
- validation repeated at every level;
- booleans and optional fields that encode meaningful mutually exclusive domain states implicitly;
- advanced TypeScript machinery whose complexity exceeds the invariant it protects;
- generic game-framework abstractions unsupported by current domain needs;
- organization based only on turn chronology;
- exports created for testing convenience rather than domain use;
- abstraction introduced solely to remove trivial duplication;
- refactoring toward a pattern without reducing caller knowledge, invariant risk, or change amplification.
