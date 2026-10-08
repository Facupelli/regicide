# Regicide — AI Teammates: Architecture Proposal

**Status:** Design reference, not an implementation spec  
**Updated:** 2026-10-08

## Goal

Allow a cooperative game to include **humans, AI teammates, or a mix**, up to the game's normal player limit. An AI occupies an ordinary player slot: it has a hand, takes turns, and appears on the same board using the same player UI. The lobby may show an AI badge, model choice, or “thinking” indicator, but gameplay components should not be duplicated for bots.

The AI **does not operate a web browser**. It receives structured information from the server and returns a player intention. Browser-driven agents remain useful for end-to-end UI testing, not as the gameplay integration.

Three concepts must remain distinct:

- **Player:** a participant in an authoritative game session.
- **Agent:** code that decides what a player should do.
- **Model:** an optional LLM used by an agent to make that decision.

The existing boundaries remain: `packages/game-engine` owns pure Regicide rules, `apps/server` owns sessions and authoritative state, `packages/protocol` defines shared contracts, and `apps/web` renders the experience.

## Agent design ideas and research

These are patterns to understand, **not** frameworks we must adopt now.

| Pattern | Idea | Application to Regicide | Read more |
|---|---|---|---|
| **Fixed workflow vs. autonomous agent** | Code controls a known sequence of steps; an autonomous agent decides its own next steps and tools. | **Use a fixed workflow** for each pending game choice. A model selects an action, and server code handles everything else. | [Anthropic — Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) |
| **Context engineering / least privilege** | The quality and boundaries of information provided to an LLM affect its decisions. | Give the AI **its hand and public information only**, plus the decision it must make. Do not leak other hands or hidden deck order. | [Anthropic — Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) |
| **Structured output / validated decisions** | Require an answer with a small, validated shape instead of interpreting free-form prose. | Request a phase-specific `PlayerCommand`; dry-run it through the engine and reject illegal commands before any future execution. | [AI SDK - Generating structured data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) |
| **Tool use / reasoning–acting loop** | An LLM can call tools, inspect the results, and decide what to do next, sometimes repeatedly. | **Defer** until one-step decisions prove insufficient. Possible tools could inspect public history or analyze hypothetical outcomes. | [AI SDK — ToolLoopAgent](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent), [Anthropic — Writing effective tools](https://www.anthropic.com/engineering/writing-tools-for-agents) |
| **Provider-independent model access** | Keep the agent's decision interface separate from the model API and its authentication. | Run the same decision workflow with a small curated list of GPT / DeepSeek models or a local heuristic bot. | [OpenRouter — OAuth/PKCE](https://openrouter.ai/docs/guides/overview/auth/oauth) |

### Why start with a fixed workflow?

Regicide is not an open-ended task. At any moment, the game already knows **which player must make which kind of decision**: play cards or yield, choose cards to discard, select a player after a Jester, etc. The agent does not need to plan arbitrary sequences of API calls.

A single decision per pending interaction is easier to understand, cheaper to run, and easier to interrupt. We can later introduce tool-assisted reasoning *behind the same decision boundary* without changing sessions or the UI.

## Proposed architecture

```text
apps/web
  Lobby: configure each slot as Human or AI; select a curated AI option
  Game: show all players using the same components
      │ human intentions / player-specific views
      ▼
apps/server (authoritative)
  Session state ──► player-specific GameView
                         │
                         ▼
                   LLM reasoning via OpenRouter
                         │
                         ▼
                   structured PlayerCommand
                         │
                         ▼
                   dry-run engine validation
                         │
                         ▼
                   validated command
                         │
                         ▼
  Future session runner: check freshness, submit through the
  shared authoritative command handler, publish player-specific views
                         │
                         ▼
packages/game-engine
  Pure rules and state transitions

packages/protocol
  Shared player intentions, views, and session/lobby contracts
```

**Key boundary:** snapshot construction can access authoritative state, but the model sees only the acting player's `GameView` and rules. Dry-run validation calls the pure engine transition and discards the result; it does not change the live session. A future runner must check freshness and route the validated command through the same authoritative handler as human intentions. The engine must have no dependency on prompts, model SDKs, credentials, or networking.

### Player slots vs. controller runtime

A session player slot should identify *who controls it* (`human` or `agent`) while keeping normal player identity and gameplay data the same. Agent configuration (for example, a selected model and a reference to the authorized user's connection) belongs with session/controller configuration, **not in the rules-engine state or public player view**.

A human command arrives asynchronously over the existing transport. An agent must be **invoked** when the session is waiting for that player's decision. Do not force these two different lifecycles into one complex player-controller abstraction merely for symmetry.

### Current decision layer

`createAgentDecisionSnapshot(state)` projects the acting player's `GameView` and captures a validator for that state. `decideAgentAction(...)` sends only the view and focused rules to OpenRouter. The model returns a structured `PlayerCommand` for the current interaction: play/yield/Solo Jester, damage discard/Solo Jester/accept defeat, or next-player selection.

The server dry-runs the command through the pure engine transition and discards the resulting state. Illegal actions fail explicitly; there is no automatic retry or fallback move. The model does not receive authoritative state, exhaustive card combinations, or temporary action IDs. The view already carries legality flags and eligible-player IDs; the engine remains authoritative for all rules.

This layer makes one decision but does not run sessions. A `GameAgent` interface may become useful when more than one real decision implementation needs it; no such interface or session runner is required for the current layer.

## A turn, from start to finish

```text
1. A future runner sees a pending decision controlled by an AI slot and captures its state/version.
2. Snapshot construction projects the acting player's `GameView`.
3. The model reasons from that view and the rules, then proposes a phase-specific `PlayerCommand`.
4. The decision layer dry-runs the command against the captured state and rejects illegal proposals.
5. The future runner checks that the decision is still current before submitting the validated command to the shared authoritative handler.
6. The server publishes fresh player-specific views to all clients.
7. If another AI decision is pending, repeat; otherwise await a human.
```

This is **decision-driven**, not a simple “one model call per turn” assumption. Some turns need several choices. Defeating an enemy can also give the same player another turn; playing a Jester changes who acts next. The runner should follow the game session's actual pending decision after *every* transition.

### Visibility and game fairness

Regicide has hidden hands and communication restrictions. A server-side AI must not receive full authoritative state simply because that state is available in-process. Its decision context should be based on the same player-specific information a human would have: **its own hand + shared/public state**.

An AI can use public history and visible card counts. It must not access teammates' hidden hands, future draws, or shuffled deck order. Any future simulation tool must work from hypothetical possibilities, not privileged hidden truth. Separate, conversational AI teammates would also need explicit communication rules (including the special Jester window); **conversation is not part of v1**.

## Model access without Regicide-funded inference

**Preferred initial integration: [OpenRouter](https://openrouter.ai/).** It provides a single API for multiple providers and supports an [OAuth/PKCE authorization flow](https://openrouter.ai/docs/guides/overview/auth/oauth), which can return a key controlled by the connecting user.

A simple lobby experience could offer:

- **Basic bot** — deterministic/heuristic, no external inference charges.
- **GPT (economy model)** — through the player's OpenRouter connection.
- **DeepSeek (economy model)** — through the same connection.

These are **fixed options in Regicide**, not an unrestricted model picker. Exact model IDs, availability, pricing, and free tiers must be checked when implementing; they can change. Free models may have request limits, so “free” must not imply unlimited play. See [OpenRouter pricing](https://openrouter.ai/pricing/).

**Cost policy:** each user-authorized model request should use that user's OpenRouter credentials/credits. **Never fall back to a Regicide-funded paid API key.** Show a clear error when a connection lacks credits or a provider is unavailable. Provider bills and the app's own hosting costs are separate; BYO model credits eliminate neither hosting costs nor the need for abuse limits.

**Credential boundary:** exchange/handle OAuth tokens carefully, keep credentials out of prompts, logs, game state, and other players' views, and restrict which session/controller may use a connection. Prefer secure server-side handling (or a deliberately designed short-lived strategy), with revocation/deletion and rate limits. The exact storage mechanism is an implementation decision.

This feature is **bring your own model**: Regicide still owns the agent's decision workflow. **Bring your own agent**—a third-party service with custom instructions and logic—is a different, later feature requiring a versioned and authenticated agent API. OpenRouter alone does not provide that contract.

## Reliability and session lifecycle

An LLM may be slow, fail, return invalid output, or finish after the game state has changed. Treat each request as belonging to a **session ID, player ID, pending decision ID, and state version**. Before applying a result, confirm that the decision is still pending. Serialize accepted session commands; do not allow concurrent agent results to race game transitions.

Use timeouts, cancellation, and visible agent status. **Do not automatically retry invalid decisions or silently yield, discard cards, or switch to another paid model on failure.** Those choices can alter a cooperative game or incur costs. An explicit pause/retry/disconnect policy should be established before release.

## Implementation direction

The single-step OpenRouter decision layer lives in `apps/server/src/agents/`: player-specific view, phase-specific structured command, and dry-run engine validation. It does not yet create AI slots, manage credentials, or submit commands. Only extract `packages/agents` if more than one real consumer needs it (for example, a separate simulation service). Keep session/lobby types in `packages/protocol` where shared with the client.

1. **Session integration:** human/AI slots, a pending-decision runner, freshness checks, shared intent submission, and identical player rendering. Verify interaction and recovery with ordinary automated tests.
2. **Model access:** user authorization, a curated GPT/DeepSeek selection, secure credential handling, and explicit error/cost behavior.
3. **Optional future work:** a basic local bot, a `GameAgent` interface if needed, tool-assisted strategy, rules-aware conversation, and externally hosted custom agents.

**Not in scope:** model comparisons/evals, autonomous multi-agent orchestration, browser-controlled teammate bots, open-ended model configuration, and Regicide-funded inference.

## Questions to settle during implementation

- How should a future runner identify and revalidate the captured pending decision before executing a proposed command?
- How are session state versions, cancellation, reconnects, and serialized commands handled today?
- Should each AI slot have its own user's OpenRouter connection, or should the session owner authorize all AI slots? (Do not assume this product policy.)
- Where can credentials be held safely, and what happens when the payer disconnects or revokes authorization?

These questions should be answered against the actual repository before changing interfaces. The design above is a direction, not a claim about existing code.
