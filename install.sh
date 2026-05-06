#!/usr/bin/env bash
# token-saver installer
# Installs the skill to ~/.claude/skills/token-saver/

set -euo pipefail

REPO_URL="https://github.com/unknownking07/token-saver.git"
SKILLS_DIR="$HOME/.claude/skills"
SKILL_DIR="$SKILLS_DIR/token-saver"

if ! command -v git >/dev/null 2>&1; then
  echo "Error: git is required but not installed." >&2
  exit 1
fi

mkdir -p "$SKILLS_DIR"

if [ -d "$SKILL_DIR/.git" ]; then
  echo "token-saver already installed at $SKILL_DIR — updating..."
  git -C "$SKILL_DIR" pull --ff-only
else
  if [ -e "$SKILL_DIR" ]; then
    echo "Error: $SKILL_DIR exists but is not a git checkout. Remove it and re-run." >&2
    exit 1
  fi
  echo "Installing token-saver to $SKILL_DIR..."
  git clone --depth 1 "$REPO_URL" "$SKILL_DIR"
fi

echo ""
echo "Done. token-saver is installed."
echo "Start a new Claude Code conversation to activate the skill."
