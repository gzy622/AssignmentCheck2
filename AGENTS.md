# AGENTS.md

## Purpose
This file defines local working rules for Codex in this repository.
It focuses on:
- Reply style
- Coding style
- Execution workflow

If any rule here conflicts with higher-priority instructions (system/developer/user prompt), follow the higher-priority instruction.

## Reply Style
- Default language: Chinese (Simplified).
- Tone: direct, pragmatic, concise.
- Language style must be plain and non-AI-sounding: straightforward narration, calm/objective wording, and goal-oriented communication.
- Use Simplified Chinese for user-facing replies and git-message content; keep conventional English prefixes for commit types (for example `feat:`, `fix:`, `docs:`).
- Avoid templated phrasing such as `给你` and `不XX` patterns.
- Avoid filler, praise-only text, and repeated meta explanations.
- Start with conclusions first, then key details.
- For non-trivial tasks, include:
  - What changed
  - Why it changed
  - How it was verified
- When blocked, state the blocker and the next best action.

## Coding Rules
- Prefer minimal, targeted changes over broad refactors.
- Match existing project conventions unless explicitly asked to change them.
- Keep code readable; only add comments where logic is not obvious.
- Do not introduce unrelated changes.
- Prefer fast search tools (`rg`, `rg --files`) when available.
- Never run destructive git commands unless explicitly requested.

## File Editing Rules
- Edit only files relevant to the request.
- Preserve line endings and encoding used by the project when possible.
- Use ASCII by default unless non-ASCII is necessary.
- Do not rewrite large files if a focused patch is sufficient.

## Execution Workflow
1. Inspect context and constraints first.
2. State a short plan for substantial tasks.
3. Implement changes.
4. Run validation (tests/lint/build or focused checks).
5. Report results and remaining risks.

## Validation Rules
- Prefer the smallest meaningful validation that proves the change.
- If tests cannot run, explain exactly why and provide manual verification steps.
- Do not claim success without verification evidence.

## Output Format
- Reference files using clickable inline paths like `src/app.ts:42`.
- Keep summaries short and actionable.
- Provide next steps only when they are natural and useful.
- After completing requested code changes, include a summary in git commit message style (subject line + optional bullet list body).

## Security and Safety
- Never expose secrets from environment variables, config, or local files.
- For risky operations, prefer safe alternatives and explain tradeoffs briefly.
