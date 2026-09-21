# Agent instructions

## Agent handoff convention (Claude Code <-> Codex)

- Read `.local/assistant-history/HANDOFF.md` before doing any work here. It holds a
  Snapshot (current git/Linear/Notion state, active-writer status, next safe pickup)
  and an append-only Log of prior sessions from either tool.
- Before ending a session that touched this repo, overwrite the Snapshot section with
  current state and append one dated Log entry (tool + model, what changed, what's
  left open). Never rewrite prior Log entries.
- Name this project's session/thread the same way in both tools: `Savortome`,
  matching the canonical name in the shared `PROJECT-PATHS.md` routing doc.
- `.local/` is gitignored — the handoff file and its history stay local to the
  machine, not in the repository history.
