---
name: token-saver
description: Pick the cheapest Claude model that can do the job. Use Haiku 4.5 for trivial extraction and Q&A, Sonnet 4.6 for thinking, planning, and most coding, and Opus 4.7 only for heavy multi-file execution or genuinely hard reasoning. Triggers when starting a new task, choosing a model, mentioning cost or tokens, switching models, or when the active model feels mismatched to the work.
---

# Token Saver: Pick the Right Claude Model

## Why this skill exists

Opus 4.7 costs roughly 5× a Sonnet token and ~25× a Haiku token. Most software work does not need Opus. Routing every prompt through Opus burns budget, slows responses, and sometimes produces *worse* output because Opus over-thinks simple problems.

This skill helps you (and Claude) pick the cheapest model that can solve the task, and only escalate when the work actually demands it.

## Decision tree

Before starting, ask: **what is the dominant cost of this task?**

| Dominant cost | Best model | Examples |
|---|---|---|
| Reading, extracting, classifying, summarizing | **Haiku 4.5** | "Pull names out of this CSV", "Summarize this log", "What does this regex do?", quick file lookups, format conversions |
| Thinking, planning, single-file edits, code review, brainstorming | **Sonnet 4.6** | Sketching a feature design, writing tests, single-file refactors, debugging with a clear repro, reviewing a diff, drafting a doc |
| Multi-file execution, hard reasoning, sustained agentic work | **Opus 4.7** | New features touching 5+ files, intermittent bugs with no clear repro, cross-system migrations, deep architecture decisions, large refactors |

## Rules of thumb

1. **Default to Sonnet 4.6.** It is the best price-to-performance for most software work. If you are unsure, start here.
2. **Drop to Haiku 4.5** when you can predict the *shape* of the answer (extraction, classification, lookup) and just need it written down quickly.
3. **Only escalate to Opus 4.7** when at least one is true:
   - Task spans 5+ files of changes
   - Sonnet has already failed once on the same task
   - Reasoning is genuinely novel, not pattern-matching
   - You need sustained agentic execution over many tool calls
4. **Brainstorm cheap, execute expensive.** Sketch the plan in Sonnet. If the implementation is heavy, switch to Opus for the *implementation* turn only, then drop back.
5. **Don't escalate mid-bug-hunt without re-reading the bug.** Often the issue is your prompt, not the model. Wasting Opus on a poorly-stated problem is the most expensive mistake.

## How to switch

**Claude Code:** type `/model` to pick interactively, or `/model opus` / `/model sonnet` / `/model haiku`.

**Anthropic API or SDK:** change the `model` parameter:

```python
# Cheap extraction / classification
client.messages.create(model="claude-haiku-4-5-20251001", ...)

# Most coding and thinking
client.messages.create(model="claude-sonnet-4-6", ...)

# Heavy multi-file execution
client.messages.create(model="claude-opus-4-7", ...)
```

## How Claude should use this skill

When the user starts work without picking a model, briefly note (one sentence) which model fits the task and why — only if the active model seems mismatched. If the user is already on a sensible model, stay quiet.

If a task that started small grows past what the current model is suited for ("this turned out to need 12 files of changes, not 1"), say so and suggest switching *before* burning more tokens at the wrong tier.

If the user asks "which model should I use for X" without giving the task, ask one clarifying question, then map to the table above.

## Other token-saving wins (beyond model choice)

These are smaller than model choice but still real:

- **Prompt caching.** When you reuse a long system prompt or context, the cached portion is ~10% of the cost. If you call the API repeatedly with the same context, turn caching on.
- **Batch API.** For non-interactive workloads, the Batch API is 50% cheaper. Good for backfills, evals, bulk classification.
- **Keep context lean.** Don't paste a whole codebase when you mean one file. Don't dump 500 lines of logs when 20 contain the failure.
- **Reuse the conversation.** Starting a new chat re-pays for the system prompt and re-reads files. If you can extend the current session, it is usually cheaper.
- **Use subagents for noisy work.** In Claude Code, send broad searches and explorations to the `Explore` subagent — its tool output stays out of your main context.

## Anti-patterns

- Running every chat in Opus "just in case"
- Using Opus for one-line fixes or typo corrections
- Sticking with Haiku after the task has clearly grown into real engineering work
- Switching models mid-conversation without context — *context* is the expensive part, not just the model
- Asking Opus to brainstorm 50 ideas when Sonnet would generate the same list at 1/5 the cost
