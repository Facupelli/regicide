# Web App Guidelines

## Architecture

- The server is authoritative for game state and legality.
- The client renders player-specific views and sends player intentions.
- Do not duplicate game-engine rules in the web app.
- `App.tsx` is the composition root and selects the active screen.
- `game-session` owns session transitions, identity, transport, revisions, and request/socket coordination.
- Game presentation owns visual sequencing and animation lifecycle.
- Screens own screen-local form and interaction state.

## Design

- Prefer information hiding, deep modules, and clear abstraction barriers.
- Represent meaningful application states explicitly. Prefer discriminated unions over interacting flags or nullable fields.
- Keep one authoritative owner for state. Prefer derived state over synchronized copies.
- Keep state at the narrowest meaningful owner.
- Use reducers when transition complexity justifies them, not by default.
- Effects synchronize with external systems. Do not use effects for ordinary application workflows or derived state.
- Do not use refs as a parallel application state model.
- Hide ordering and coordination invariants behind meaningful operations.
- Prefer composition and explicit variants over boolean-prop configuration.
- Use Context only for genuine shared ownership across a subtree.
- Prefer locality before reuse. Do not extract code merely to reduce file size or duplication.
- Do not replace a large component with a large hook unless the new boundary actually hides knowledge.
- Avoid speculative abstractions.

## Source Structure

Organize `src` primarily by application concept, not technical type.

Keep implementation details beside the concept that owns them. Promote code to a top-level or shared module only when it genuinely spans concepts or represents an application-wide abstraction.

Avoid generic root-level buckets such as `components`, `hooks`, `utils`, and `services`.

Shared `ui` is for genuinely cross-screen UI primitives, not game-specific components.

## Verification

Preserve behavior unless a behavior change is explicitly requested.

After web changes, run the repository checks from the repo root.

For changes involving interaction state, async workflows, HTTP/WebSocket coordination, or presentation timing, verify the affected flow in the browser as well.
