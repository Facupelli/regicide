---
name: verify
description: Verify Regicide behavior through the real local web application and HTTP API after user-visible or gameplay changes.
---

# Verify

Verify the changed behavior through the real running application.

Runtime behavior is the source of truth. Use source code only to understand or debug an observation.

## Environment

The developer owns the local application processes.

Expected services:

- Web: `http://localhost:3001`
- Server: `http://localhost:3000`

Do not start, restart, or stop developer-owned application servers unless explicitly asked.

## Interfaces

Use:

```text
bin/browser       Browser interaction
pnpm verify:http  Deterministic HTTP verification
```

Use `bin/browser` for browser work. Do not invoke `chrome-devtools-axi` directly or manage its session environment.

Before browser verification, run:

```bash
bin/browser pages
```

If the browser or application is unavailable, report the infrastructure problem.

## Verification scope

Verify the smallest real user flow that proves the requested behavior.

Do not play through unrelated game phases only to reach the state under test.

When a deep gameplay state is required, prefer a deterministic legal setup through the HTTP interface when that setup is not itself under test. Then exercise the behavior being verified through the real UI.

A full-game playthrough is required only when the behavior being verified depends on the complete game progression or the user explicitly requests one.

## HTTP baseline

Run:

```bash
pnpm verify:http
```

when the change can affect server behavior or when a browser failure may originate at the web/server boundary.

Treat a passing HTTP verification as the deterministic server-contract baseline.

Do not rerun it during the same verification unless relevant code or server state changed.

## Browser snapshots

Browser commands may return a fresh `snapshot:` as part of their own output.

When a command returns a snapshot, that snapshot is the current accessibility tree. Do not immediately run `bin/browser snapshot` again.

Use an explicit snapshot only when:

- no current snapshot is available;
- the page changed asynchronously after the last browser output;
- a reference became stale;
- the UI structure is unknown and broader inspection is necessary.

Snapshot references are transient. Use references only from the newest relevant snapshot.

Prefer accessible names and roles. Use stable identifiers only when semantic identity is insufficient.

## Interaction

Exercise behavior through the real UI.

Prefer:

- accessible names;
- visible labels;
- roles;
- stable application identifiers.

Avoid incidental position, ordering, or surrounding markup.

Once an interaction sequence is known and no reasoning is required between its steps, group it instead of alternating one command and one broad observation.

Do not guess browser commands. Use:

```bash
bin/browser --help
bin/browser <command> --help
```

## Observation

Collect only the evidence needed for the current decision.

Prefer, in order:

1. a focused `eval` or project-specific read-only probe for known state;
2. the fresh snapshot already returned by the previous browser action;
3. a focused network or console query;
4. an explicit broad snapshot when the structure is unknown.

Do not repeatedly inspect the full page to read values that can be obtained with a compact probe.

Observation may inspect application state. It must not inject, mutate, or force the state being verified.

## Waiting

Wait for observable application state instead of arbitrary delays.

Examples:

```bash
bin/browser wait "Current enemy"
bin/browser wait "Discard selected cards"
bin/browser wait "Victory"
bin/browser wait "Defeat"
```

After a wait, use evidence already returned by the command when sufficient. Do not add a snapshot automatically.

Use numeric waits only when no observable state exists.

## Gameplay proof

For a gameplay change, prove the specific affected transition.

Relevant evidence can include:

- the user action;
- current interaction;
- hand contents or count;
- enemy health, attack, or shield;
- Tavern, Castle, or discard state;
- victory or defeat;
- the corresponding HTTP request and response when needed.

Do not infer correctness from the absence of errors.

Do not continue playing after the requested behavior is proven unless later state is part of the behavior under test.

## Invalid actions

When rejection behavior is relevant, exercise one representative invalid action through the real UI.

Verify that:

- the action is rejected;
- the error is visible;
- authoritative game state does not change unexpectedly;
- the user can correct the action and continue.

Do not exhaustively explore invalid combinations unless requested.

## Network and console

Inspect network traffic only when needed to prove or debug the browser/server boundary.

```bash
bin/browser network --type fetch --limit 30
bin/browser network-get <id>
```

Check relevant browser errors before declaring browser verification clean:

```bash
bin/browser console --type error --limit 30
```

Do not repeatedly query network or console state after every interaction.

## Result

Report a verification as `VERIFIED`, `NOT VERIFIED`, or `INCONCLUSIVE`.

A successful verification names the behavior exercised and the concrete runtime evidence that proves it.

If a bug, unexpected state, failed request, console error, or infrastructure problem appears, report it. Do not work around it to obtain a passing result.

## Cleanup

Stop browser sessions created by the verification run:

```bash
bin/browser stop
```

Do not use `pkill`, `killall`, or process-name matching.

Do not stop developer-owned web or server processes.
