# token-saver

A Claude skill that helps you (and Claude) pick the cheapest model that can do the job.

Most tasks do not need Opus 4.7. This skill teaches Claude to:

- Use **Haiku 4.5** for extraction, classification, and quick lookups
- Use **Sonnet 4.6** for most coding, planning, and code review
- Reserve **Opus 4.7** for heavy multi-file execution and genuinely hard reasoning

The skill activates automatically when you start a new task, mention cost, or switch models — and reminds you mid-session if the work has outgrown (or is overkill for) the active model.

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

| Task | Model |
|---|---|
| Read a log, summarize a file, classify text | Haiku 4.5 |
| Plan a feature, write tests, review a diff, single-file refactor | Sonnet 4.6 |
| Multi-file refactor, hard debugging, deep architecture | Opus 4.7 |

Switching in Claude Code: `/model opus` / `/model sonnet` / `/model haiku`.

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
