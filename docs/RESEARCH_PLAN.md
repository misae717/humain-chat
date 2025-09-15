# HUMAIN Research Plan: Extractors, Embeddings, Tools, and Agent Ops

Goals
- Local-first embeddings; GPT-5 hosted for LLM inference.
- Fast, accurate retrieval across Markdown, PDF, DOCX, PPTX.
- Agent can create/edit Markdown in the vault (safe, auditable).

1) Document extractors (ingestion)
- Markdown/MDX
  - Parsing headings, code blocks, frontmatter; chunk by semantic sections.
  - Preserve links/backlinks.
- PDF
  - Text extraction: compare pdf.js vs. pdf-parse vs. Tesseract for scanned PDFs.
  - Preserve page numbers; handle columns; extract captions/figures where possible.
  - Heuristics for chunking: page blocks, heading detection, paragraph grouping.
- DOCX
  - Tools: `mammoth`, `docx` parsers; style to structure mapping (heading levels, lists).
- PPTX
  - Tools: `pptx-parser`, `officeparser`, `unoconv`-based flows; text per slide with notes.
- Images (optional)
  - OCR for images/screenshots: Tesseract OCR or local OCR model; store text + bounding boxes.
- Common requirements
  - Character normalization (Unicode), whitespace cleanup.
  - Language detection (fastText or CLD3) to select multilingual embedding if needed.
  - Hash-based change detection per chunk to avoid re-embedding unchanged content.

Deliverables to compare
- Accuracy of text extraction (qualitative + small gold set).
- Speed per page/MB; memory usage.
- Robustness to complex layouts.

2) Chunking strategy
- Markdown: heading-based hierarchical chunks with max chars/tokens (e.g., 400–800 tokens).
- PDFs/DOCX/PPTX: paragraph/slide blocks with contextual overlap (e.g., 10–20% overlap).
- Metadata per chunk: source path, type, page/slide, heading trail, offsets.
- Store raw text hash for re-embed decisions.

3) Embedding models (local preferred)
- Baseline candidates
  - bge-m3 (multilingual, passage/document/query unified).
  - nomic-embed-text v1/v1.5 (fast, widely used, good MTEB performance).
  - Snowflake Arctic Embed (xs/s/m; good efficiency options).
  - TaylorAI/bge-micro-v2 (used by Smart Connections default; very fast, compact).
- Additional candidates
  - e5-mistral; jina-embeddings-v3; voyage-lite; sentence-transformers variants.
- Criteria
  - MTEB scores (retrieval subsets); multilingual performance if needed.
  - Vector dimensionality (smaller dims improve storage/ANN speed).
  - Throughput on target hardware (CPU vs. GPU; quantization support).
  - License and on-disk size.
- Benchmarks to run
  - In-vault retrieval quality (manual relevance judgments on a sample corpus).
  - Latency per 1k chunks; index build time; memory footprint.
  - ANN search latency at K=5..20.

4) Vector index / ANN search
- Options
  - Local: HNSW (hnswlib), FAISS (CPU/GPU), SQLite+sqlite-vss, Vald, Qdrant/Weaviate (if acceptable).
  - In-process preferred (no external service) for simplicity; consider FAISS/HNSW.
- Requirements
  - Incremental upserts and deletes.
  - Persist index to disk; versioned compatibility.
  - Filter by metadata (path, type, date) and re-rank by recency or TF-IDF hybrid.

5) RAG assembly
- Retrieval pipeline
  - Build query embedding; ANN top-K; optional BM25 hybrid.
  - Deduplicate by source; diversity via MMR.
  - Context builder that formats citations with source and page/slide.
- Token budgeting for GPT-5
  - Reserve system/instructions; pack chunks until ~6–8k context; truncate gracefully.
- Safety
  - Strip PII if configured; redact secrets; obey vault exclusions.

6) Agent operations on the vault
- Capabilities
  - Create Markdown notes; append/insert sections; refactor file/folder structure.
  - Generate summaries, link suggestions, and backreferences; maintain frontmatter.
- Safety & auditing
  - Dry-run preview; diff view; undo log per operation; user confirmation gates.
  - Batch mode with per-file confirmations.
- API design
  - High-level actions: create_note, update_section, move_file, add_links, apply_template.
  - Policy layer: path allowlist/denylist, size limits, naming conventions.

7) Integration with HUMAIN Chat
- Retrieval middleware
  - Hook: before sending to GPT-5, enrich messages with top-K retrieved snippets + citations.
- Tool use (future)
  - Expose agent tools for file ops; confirm actions in UI with progress indicators.
- Settings
  - Embedding backend selection, index location, extractors toggles, re-embed thresholds.

8) Tooling & stack
- Language/runtime: TypeScript + Node for extractors/embedding pipeline.
- Local embedding runners
  - Ollama; LM Studio; transformers.js (webgpu/cpu) for small models.
- ANN libraries
  - hnswlib (Node bindings), FAISS via Python subprocess (if needed), or pure TS libs if performant enough.
- Job scheduling
  - Queue with concurrency limits; resume on startup; background workers; progress UI.
- Testing
  - Golden extraction set; retrieval relevance test set; performance regression checks.

9) Evaluation plan
- Build a small labeled dataset from team PDFs, DOCX, PPTX, and notes.
- Define metrics: nDCG@k / Recall@k; latency percentiles; memory footprint; index size.
- Iteratively test extractor + embedder combos; pick top 2–3 stacks.

10) Deliverables
- Prototype extraction service with pluggable extractors and chunker.
- Embedding runner abstraction with local backends.
- Persistent vector index; metadata store.
- HUMAIN Chat integration with retrieval and citations.
- Agent ops API with safety guards (dry-run + review).
