HUMAIN Chat — Agent Refactor (LangChain/LangGraph)

Overview
We replaced the legacy chat loop with a LangGraph/ChatOpenAI agent and explicit tools that operate over the Obsidian vault.

Key files
- src/agent/graph.ts: agent entrypoint, tool loop, trace collection
- src/ui/chatView.ts: Chat view, routes messages to the agent
- src/vector/rag.ts: JSONL/LanceDB retrieval and embeddings; query rewrite helper
- src/ui/debugView.ts and src/ui/traceView.ts: observability panes
- src/main.ts + src/settings.ts: auto-open panes and settings

Runtime flow (per turn)
1) ChatView sends system + prior conversation (token-limited) + user to the agent
2) Agent executes a bounded loop (max 6):
   - Model invoked with tools bound
   - If tool_calls present → execute tools, append tool results, and repeat
   - If no tool_calls → message is final answer
3) Tools
   - find_similar(query, k?, filter?): embeds query via Ollama, searches JSONL/LanceDB, MMR; in agent path, query rewrite disabled to avoid loops; folder filter ignores "/" and blanks
   - read_note(note_path, max_chars?): reads MD or extracts PDF/DOCX/PPTX
   - vault_outline(maxFolders?, maxChars?): cached (60s) high-level folder counts

Retrieval & indexing
- Index backend: JSONL file (vault/.humain-index/index.jsonl) with incremental metadata (index.meta.json)
- Optional LanceDB backend if native module is available (desktop only)
- Embeddings: Ollama POST /api/embed with a 15s timeout
- Query rewrite: available for manual retrieval features; disabled in agent tool path

Observability
- Debug view: structured logs (retrieval, agent, error)
- Trace view: per-turn trace (model steps, tool args/results)
- Settings can auto-open Debug/Trace alongside Chat; optional auto-include vault outline

Important limits & guards
- Stateful context window (~6k tokens of prior messages)
- Tool loop: max 6 steps; find_similar ≤ 3 calls/turn
- Early-stop: 2 consecutive empty retrievals → answer without more tools
- Timeouts: embeds 15s; query-rewrite 10s; folder filter normalization

Known tradeoffs / next steps
- Reranker, streaming final, optional query rewrite in tools behind a toggle
- Per-type chunking presets; better PPTX/PDF extractors; hybrid BM25+vector
- Consider stateful chat memory (currently stateless per turn)


