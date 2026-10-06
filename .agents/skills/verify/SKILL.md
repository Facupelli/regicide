---
name: verify
description: Verify Regicide end to end through the real local web application and HTTP API after browser-visible gameplay changes.
---

# Verify

Verify behavior through the real running application.

Runtime behavior is the source of truth. Use source code only to understand or debug what you observe.

## Environment

The developer starts the local applications before verification.

Expected services:

- Web: `http://localhost:3001`
- Server: `http://localhost:3000`

Do not start, restart, or stop developer-owned application servers unless explicitly asked.

## Verification interfaces

Use:

```text
bin/browser       Browser interaction
pnpm verify:http  Deterministic HTTP verification
```

Use `bin/browser` for all browser interaction.

Do not invoke `chrome-devtools-axi` directly or manage its session environment yourself.

## Deterministic baseline

Before investigating a browser-visible failure that may involve the backend, run:

```bash
pnpm verify:http
```

Treat this as the deterministic HTTP contract baseline.

If it passes while the browser flow fails, investigate the web/API-client/browser boundary first.

## Browser readiness

Before browser verification:

```bash
bin/browser pages
```

If the browser tool or required application is unavailable, report the infrastructure problem instead of rebuilding the tooling.

## Interaction

Exercise behavior through the real UI.

Prefer stable semantic targets:

- visible labels
- accessible names
- roles
- stable identifiers

Avoid targeting controls by incidental position, ordering, or surrounding markup when a semantic target is available.

Snapshot references are transient. After navigation or a state-changing interaction, refresh the snapshot before reusing references when needed.

Do not guess unfamiliar browser commands. Use:

```bash
bin/browser --help
bin/browser <command> --help
```

## Observation

Use the smallest observation that proves or disproves the expected behavior.

Prefer:

- focused snapshots for nearby UI state;
- `eval` for a specific DOM value or property;
- focused network inspection for a specific request;
- console inspection for runtime errors;
- broad snapshots only when the UI structure is unknown.

Do not collect large unfiltered browser, network, or console output unless focused evidence is insufficient.

## Waiting

Prefer observable application state over arbitrary delays.

Examples:

```bash
bin/browser wait "Current enemy"
bin/browser wait "Discard selected cards"
bin/browser wait "Victory"
bin/browser wait "Defeat"
```

Use a numeric wait only when no useful observable state exists.

Use grouped browser commands only when the interaction sequence is already known and no reasoning is needed between steps.

## Gameplay verification

For gameplay changes, exercise the real player flow far enough to prove the behavior.

Typical solo flow:

```text
Start Solo Game
→ inspect the current state
→ select card(s)
→ submit an action
→ handle the next interaction
→ verify the resulting state
```

When relevant, continue through later turns, enemy defeat, Solo Jester use, damage discard, victory, or defeat.

Verify visible state changes that matter to the behavior, such as:

- hand contents
- enemy damage
- shield
- Tavern count
- Castle count
- discard count
- current interaction
- victory or defeat

Do not infer correctness only from the absence of errors.

## Invalid actions

When relevant, deliberately exercise an invalid action through the UI.

Verify that:

- the action is rejected;
- the UI shows the error;
- the authoritative game view does not change unexpectedly;
- the player can correct the selection and continue.

## Network and console evidence

Use focused network inspection when a browser action needs deeper verification:

```bash
bin/browser network --type fetch --limit 30
```

Inspect a specific request with:

```bash
bin/browser network-get <id>
```

Check browser errors with:

```bash
bin/browser console --type error --limit 30
```

A UI interaction is not cleanly verified if it causes a new relevant console error.

## Evidence

A successful verification should show concrete runtime evidence for the requested behavior.

When useful, combine:

- the real user action;
- the resulting UI state;
- the relevant request/response;
- console output.

If verification exposes a bug, unexpected state, failed request, or console error, report it instead of working around it.

## Cleanup

Before finishing, stop every browser session created by the verification run:

```bash
bin/browser stop
```

Do not use `pkill`, `killall`, or process-name matching.

Do not stop developer-owned web or server processes.
