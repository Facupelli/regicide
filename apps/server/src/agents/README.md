These are the agent-building patterns and principles we'll use for Agents module in Regicide:

1\. Single-step agent workflow The LLM makes one game decision per invocation. The server controls when to invoke it. We don't need an autonomous, multi-step agent loop.

2\. Context engineering Provide the LLM with the information needed to reason effectively: Regicide rules, its own `GameView`, legal actions, and potentially relevant public history. Avoid unnecessary or private information.

3\. Constrained action selection The game engine generates legal action candidates. The LLM reasons about its options and selects one, rather than inventing arbitrary commands.

4\. Structured outputs The LLM returns a predictable response, such as `{ actionId: string }`. The server maps that selection to an existing `PlayerCommand`.

5\. Separation of reasoning and execution The LLM decides what to do, but never modifies game state directly. The authoritative server validates and executes its decisions through the existing game engine.

6\. Provider-independent agent abstraction Define a small `GameAgent` interface independent of any AI SDK or model provider. OpenRouter handles model access, while Regicide owns the agent workflow.

7\. Event-driven orchestration Invoke the agent when the game reaches a decision assigned to it. Prevent duplicate invocations, reject stale decisions, and handle timeouts or failures explicitly.

8\. Human-equivalent information boundaries Agents receive only information available to their player. They cannot inspect hidden hands or deck order, even though they execute on the authoritative server.

What we're deliberately not using: autonomous tool loops, multi-agent orchestration frameworks, rule-based bots, model evaluations, or long-term agent memory.

The central design is simple: Regicide controls the workflow; the LLM provides the strategic reasoning.
