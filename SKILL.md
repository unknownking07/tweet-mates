---
name: token-saver
description: Save tokens on Claude. Pick the cheapest model that can do the job — Haiku 4.5 for trivial extraction and Q&A, Sonnet 4.6 for thinking, planning, and most coding, Opus 4.7 only for heavy multi-file execution. Also covers keeping chats tight and using persistent memory files (CLAUDE.md, memory) so Claude doesn't re-derive context every session. Triggers when starting a task, picking a model, mentioning cost or tokens, switching models, when chats are getting long, or when the same context keeps getting re-explained.
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
4. **Opus is built to execute, not brainstorm.** Use Sonnet (or Haiku for rough ideation) to sketch the plan. Only switch to Opus for the heavy *execution* turn — then drop back. Asking Opus to "give me 20 ideas" is the most over-paid prompt in the wild.
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

## Beyond model choice

Model selection is the biggest lever. These compound on top of it:

- **Keep chats tight.** Every turn re-reads all prior tokens, so cost grows with chat length. Scope one chat to one task. When the task is done, start a new chat for the next one — don't let unrelated work pile up in the same context. The failure mode isn't starting fresh; it's letting a single thread sprawl across half a day of unrelated questions.

- **Give Claude memory.** Persistent files mean Claude doesn't re-derive context every session:
  - **`CLAUDE.md`** in your repo root — project conventions, key files, how to run things, anything you'd otherwise type into every new chat.
  - **Memory files** (e.g. `~/.claude/projects/<project>/memory/`) — facts about your role, the project, and your preferences that should persist across sessions.
  - **Skills / `instructions.md`** — reusable task playbooks. Write once, reuse forever.

  One-time write, every-session payoff. The cheapest token is the one Claude never has to read because it already knows.

- **Lean context in.** Don't paste an entire codebase when you mean one file. Don't dump 500 lines of logs when 20 contain the failure. Quote precisely; trim aggressively.

- **Use subagents for noisy work.** In Claude Code, send broad searches and explorations to the `Explore` subagent — its tool output stays out of your main context, so the chat history doesn't bloat with grep results.

- **Prompt caching (API).** When you reuse a long system prompt or context across calls, the cached portion costs ~10% of normal. Turn it on for any repeated-call workload.

- **Batch API.** For non-interactive workloads, the Batch API is 50% cheaper. Good for backfills, evals, bulk classification.

## Anti-patterns

- Running every chat in Opus "just in case"
- Using Opus for one-line fixes or typo corrections
- **Brainstorming with Opus** when Sonnet (or Haiku) would generate the same ideas at a fraction of the cost — Opus is built to execute, not ideate
- Sticking with Haiku after the task has clearly grown into real engineering work
- Switching models mid-conversation without context — *context* is the expensive part, not just the model
- **Letting one chat balloon across many unrelated tasks** — context cost compounds; close it and start fresh
- **Re-explaining your project every session** because you never wrote a `CLAUDE.md` or memory file
