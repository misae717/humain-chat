# HUMAIN – Current System Summary (PoC)

## 1) Overview
- Obsidian plugin providing an in‑vault chat assistant with retrieval‑augmented generation (RAG)
- Local embeddings via Ollama `/api/embed`; JSONL vector index (incremental)
- Extractors for Markdown, DOCX, PPTX, and PDF (pdfjs-dist)
- Debug view for retrieval/prompts/responses; status bar progress for indexing

## 2) Architecture (as‑built)
- Entry `src/main.ts`: registers chat and debug views, settings, commands, status bar; runs index jobs
- Chat view `src/ui/chatView.ts`: UI, input, markdown rendering, OpenAI calls, retrieval enrichment
- RAG `src/vector/rag.ts`: indexing (chunking, hashing, incremental), retrieval (K=20, penalties+MMR)
- Extractors `src/vector/extractors.ts`: DOCX (xml via JSZip), PPTX (slide grouping), PDF (pdfjs)
- Tools/commands `src/commands/index.ts`: rebuild index, open debug view, export samples, tree scan
- Settings `src/settings.ts`: OpenAI, gradient/glass UI, retrieval config, extractors toggles
- Styles `styles.css`: glass/gradient/animations, chat bubble, progress styles

## 3) Indexing & Chunking
- Incremental rebuild
  - `index.jsonl`: one JSON per chunk `{id,path,content,embedding}`
  - `index.meta.json`: file hashes + chunk counts
  - On rebuild: unchanged files kept; changed files re‑embedded; removed files pruned
- Chunking
  - Paragraph/sentence aware with heading hints
  - Target ~700 tokens (~2800 chars) with ~100 tokens overlap (~400 chars)
  - PPTX: groups 4 slides per chunk to avoid sparse slide bias
- Extractors
  - DOCX: `word/document.xml` → stripped text paragraphs
  - PPTX: `ppt/slides/slide*.xml` → grouped slide text
  - PDF: pdfjs‑dist text content per page; concatenated with headings

## 4) Retrieval
- Query → optional LLM query rewrite (manual features) → embed → ANN over JSONL
- Top‑K default 20; penalties for very short chunks; simple MMR diversification
- Chunks carry `section` (e.g., slide number / first heading) and `start/end` offsets
- Folder filter normalization: root "/" ignored; only real subfolders filter
- Returned context includes path + snippet; citations are inserted in answers
- Backends
  - Primary: JSONL (portable)
  - LanceDB attempted runtime load; currently falls back to JSONL

## 5) Chat & UI
- Stateful: prior messages (~6k tokens) included each turn
- Vault outline tool (cached) and optional auto-include per turn
- Markdown rendering in chat bubbles; clickable links; improved status UI
- Debug view logs retrieval context and OpenAI req/resp; Trace View shows per-turn steps
- Indexing progress: status bar percentage; logs streamed to Debug view
- Tree scan command: lists indexable vs non‑indexable by folder and extension
- Sample export command: writes 3× DOCX/PPTX/PDF extracts for review

## 6) Agent Direction (planned default)
- Single loop becomes agent loop by default (no toggle)
- Phases
  1. Greet/structure: initial short message to mask latency; outline plan
  2. Tool calls (bounded):
     - `find_similar({ queries[], k, filter })` → returns `{path, section?, score, snippet}`
     - `read_note({ path, section? | byte/line range })` → yields bounded text
     - Future: link/edit tools; mindmap rendering; frontmatter updates; staging/commit
  3. Observe: summarize tool output succinctly before feeding back
  4. Iterate up to N steps (setting); exit conditions for “sufficient” or “no evidence”
  5. Finalize: stream user‑facing prose answer with citations and file chips
- UX
  - Token‑by‑token streaming only for final response
  - Tool status chips with concise descriptions (e.g., “Searching vault… K=20”)
  - Clickable citations link to notes/files; show open options for non‑MD

## 7) Settings (key)
- OpenAI: API key, model, base URL
- Retrieval & Embeddings:
  - Host/model for Ollama
  - Index directory
  - Top‑K (default 20)
  - Chunk size/overlap
  - (Planned) MMR λ, min chunk length, path boosts/penalties
  - Include/exclude folders
  - Query rewrite toggle + max generated queries
- Extractors toggles: PDF, DOCX, PPTX

## 8) Known Gaps / Gotchas
- LanceDB native loading is brittle inside Obsidian; JSONL chosen for stability
- PDF extraction quality varies; complex layouts may need heuristics/ocr
- Retrieval latency depends on Ollama model and machine; batching helps
- `Welcome.md`/very short generic notes can over‑rank without penalties (now mitigated)
- PPTX extraction ignores speaker notes; could integrate notes later
- No click handler yet to open non‑MD within Obsidian; links render as wikilinks

## 9) Next Priorities
1. Rebuild index (slide grouping + MMR penalties active)
2. Agent loop wiring as default flow: `find_similar`, `read_note`, bounded steps
3. Clickable citations → open note/file; better chat markdown styles (tables/code)
4. Settings for MMR λ, min‑chunk chars, path boosts/penalties; K tuning
5. Extractor Sandbox view: preview/tune outputs; add PPTX notes/PDF layout heuristics

## 10) Developer Notes
- Performance
  - Batch embeds (≤16 inputs) to balance payload and server throughput
  - Keep chunks ~700 tokens to avoid Ollama truncation; include overlaps
- Safety
  - Keep tool outputs summarized before echoing to model
  - Staging for write tools; diff/undo planned
- Debugging
  - Use Debug view for retrieval inspection and prompt diffs
  - Use tree scan to find non‑indexables; add extractors as needed



