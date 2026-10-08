These are the agent-building patterns and principles we'll use for Agents module in Regicide:

1\. Single-step agent workflow The LLM makes one game decision per invocation. The server controls when to invoke it. We don't need an autonomous, multi-step agent loop.

2\. Context engineering Provide the LLM with the information needed to reason effectively: Regicide rules and the acting player's `GameView`, including its hand, public information, and pending decision. Avoid unnecessary or private information.

3\. Phase-specific decisions The LLM proposes a `PlayerCommand` appropriate for the pending decision. Do not enumerate card combinations or send temporary action IDs.

4\. Structured outputs Use a phase-specific schema for the proposed command. Dry-run it through the game engine against the captured state and explicitly reject illegal commands.

5\. Separation of reasoning and execution Dry-run validation discards the resulting state; it does not modify the live session. A future session runner must check freshness and submit the validated command through the authoritative handler.

6\. Provider-independent decision logic Keep Regicide's prompt, observation, and validation logic separate from OpenRouter communication. Defer a `GameAgent` interface until it has a real use.

7\. Future event-driven orchestration Invoke the agent when the game reaches a decision assigned to it. Prevent duplicate invocations, reject stale decisions, and handle timeouts or failures explicitly. Session integration is not part of the current decision layer.

8\. Human-equivalent information boundaries Agents receive only information available to their player. They cannot inspect hidden hands or deck order, even though they execute on the authoritative server.

What we're deliberately not using: autonomous tool loops, multi-agent orchestration frameworks, rule-based bots, model evaluations, or long-term agent memory.

The current decision flow is:

```text
Player-specific GameView
  -> LLM reasoning
  -> structured PlayerCommand
  -> dry-run engine validation
  -> validated command
  -> future session runner
```

Regicide controls the workflow; the LLM provides the strategic reasoning.
