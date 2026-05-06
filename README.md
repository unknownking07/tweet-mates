# token-saver

A Claude skill that helps you (and Claude) save tokens without sacrificing output quality.

The four levers it teaches:

- **Right model for the task** — Haiku 4.5 for extraction, Sonnet 4.6 for most coding, Opus 4.7 only for heavy execution
- **Don't brainstorm with Opus** — it's built to execute, not ideate; use Sonnet/Haiku for ideas, then escalate for the heavy turn
- **Keep chats tight** — every turn re-reads all prior tokens; scope one chat to one task and start fresh for the next
- **Give Claude memory** — `CLAUDE.md`, memory files, and skills mean Claude doesn't re-derive context every session

The skill activates automatically when you start a new task, mention cost, switch models, or when chats start sprawling.

## Install

One line:

```bash
curl -fsSL https://raw.githubusercontent.com/unknownking07/token-saver/main/install.sh | bash
```

Or manually:

```bash
git clone https://github.com/unknownking07/token-saver.git ~/.claude/skills/token-saver
```

That puts the skill at `~/.claude/skills/token-saver/SKILL.md`, where Claude Code picks it up automatically. Start a new conversation and it's live.

## Usage

The skill auto-triggers on:

- Starting a new engineering task
- Asking "which model should I use for X?"
- Mentioning cost, tokens, budget, or switching models
- Telling Claude the current task feels too heavy or too light for the active model

You can also invoke it explicitly:

```
/token-saver
```

## Quick reference

**Model for the task:**

| Task | Model |
|---|---|
| Read a log, summarize a file, classify text | Haiku 4.5 |
| Plan a feature, write tests, review a diff, single-file refactor | Sonnet 4.6 |
| Multi-file refactor, hard debugging, deep architecture | Opus 4.7 |

Switching in Claude Code: `/model opus` / `/model sonnet` / `/model haiku`.

**Token-saving habits:**

- Brainstorm in Sonnet/Haiku → execute in Opus only when needed
- One chat = one task; close it when done
- Write a `CLAUDE.md` for any repo you'll touch more than twice
- Keep context lean — quote the 20 lines that matter, not the whole file

## Update

```bash
git -C ~/.claude/skills/token-saver pull
```

Or re-run the install script.

## Uninstall

```bash
rm -rf ~/.claude/skills/token-saver
```

## License

MIT
