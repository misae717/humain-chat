# HUMAIN Agent – Default Flow (Spec)

## Goals
- Replace single-step chat with a bounded multi-step agent loop by default
- Keep UX crisp: non-streaming during tool phases; stream only the final user message
- Deterministic, auditable tool calls; fail fast, summarize large tool outputs

## Roles & Messages
- system: persona, policies, safety, output constraints
- developer: tool contracts and strict JSON schema for tool calls
- user: human prompt
- assistant: either a JSON tool call or final prose
- tool: tool results (summarized)

## Loop (Decide → Tool → Observe)×N → Finalize
1) Decide (non-streaming)
   - Model receives user + developer/tool schemas + any prior tool results
   - Either emits a single JSON tool call or chooses to finalize
2) Run Tool
   - Plugin validates schema, enforces timeouts/limits, returns summarized result
3) Observe
   - Append tool result to messages (role: tool)
4) Repeat
   - Bound by Max Tool Calls (setting) and stop conditions (sufficient evidence)
5) Finalize
   - Stream the final answer to user with citations and file chips

## Tools (initial)
- find_similar
  - description: Search embeddings and return nearest notes/blocks
  - input: { queries: string[]; k: number; filter?: { folder?: string; tag?: string } }
  - output: { ok: boolean; data: Array<{ path: string; section?: string; score: number; snippet: string }>; took_ms: number }
- read_note
  - description: Read note or a section/range for deep dive
  - input: { path: string; section?: string; start?: number; end?: number; max_chars?: number }
  - output: { ok: boolean; text: string; meta?: { path: string; section?: string } }

(Future tools)
- link_notes, upsert_frontmatter, render_mindmap, write_note, append_note, commit_staged_changes

## Policies
- Non-streaming during tool phases; stream only final
- Summarize large tool outputs to keep token usage stable
- Respect allowlists/filters for folders; redact secrets if configured
- Stop early if confidence low and no progress across 2 iterations

## Settings (planned)
- Max Tool Calls: default 3 (1–8)
- Generated Queries: enable/disable; max 3
- Retrieval K: default 20
- MMR lambda: default 0.5
- Min chunk length penalty: default 160 chars

## UI
- Chat shows:
  - Initial short “plan” line to mask retrieval latency
  - Inline status chips for each tool run (e.g., “Searching… K=20”)
  - Streamed final answer with citations
- Clickable citations/file chips open note or offer open actions for non‑MD

## Error Handling
- ToolTimeoutError: show brief status; suggest narrower scope
- SchemaViolation: one retry with repaired JSON else surface error
- Read conflicts: clip text to max_chars; suggest alternate section

## Telemetry (Debug)
- Log tool calls, durations, chars read, K, backoff
- Log retrieved items (path, score, snippet)
- Respect redaction settings

