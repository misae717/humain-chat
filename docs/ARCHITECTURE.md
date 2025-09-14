# Architecture

- Entry: `src/main.ts` registers the chat view, settings, commands.
- View: `src/ui/chatView.ts` owns UI, message list, input, and OpenAI calls.
- Settings: `src/settings.ts` exposes UI config and persists via Obsidian data APIs.
- Types: `src/types.ts` centralizes settings defaults and constants.
- Styles: `styles.css` contains gradient/glass, ocean/noise animations, and components.

Chat flow (non-streaming):
1. User submits → message appended (user) → pending assistant bubble.
2. `callOpenAI()` posts to `/v1/chat/completions` with multi-turn context (~6k tokens).
3. Response replaces pending bubble. Errors surface in-line for debugging.

Context window limiting:
- Simple character→token estimate (~4 chars per token) trims history from newest back, preserving initial system prompt.

Animation scope:
- All gradients and motion are scoped to `.humain-chat-view` to avoid leaking into other panes.

Branching:
- Active development on `dev`. Merge to `main` only when stable.
