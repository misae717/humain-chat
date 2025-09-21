HUMAIN Chat — Debugging & Observability

Panes
- Debug View: live structured logs (types: agent, retrieval, error, openai)
- Trace View: per-turn cards with model requests/responses and tool args/results
- Settings → Auto-open Debug/Trace panes next to Chat (toggle on/off)

How to open
- Command Palette: “Open HUMAIN Debug View”, “Open HUMAIN Trace View”
- Or auto-open via settings when Chat opens

What is logged
- Retrieval
  - Backend (JSONL vs LanceDB)
  - Query rewrite counts (if used outside agent tool path)
  - Top‑K and penalties for very short chunks
- Agent
  - Turn start/end
  - Model steps with token/finish metadata
  - Tool calls (name, arguments) and tool results (truncated)
- Error: structured error message with minimal stack detail

Common issues
- Loops with empty retrieval → guard triggers after 2 empty results
- Duplicate tool calls → deduped by (name,args) signature
- Timeouts → embeddings (15s) and query rewrite (10s) aborts

Tips
- Use Trace View to verify grounding: retrieved paths + snippets → read_note text → final answer cites the same files
- If citations look wrong, re-run indexing (command: “Rebuild HUMAIN Embeddings Index”) and verify Ollama is reachable


