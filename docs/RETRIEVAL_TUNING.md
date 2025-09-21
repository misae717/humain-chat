# Retrieval Tuning

## Current pipeline
- LLM query (optional query-rewrite → multiple subqueries)
- Embed queries via Ollama `/api/embed`
- Search JSONL index (cosine)
- Penalize short chunks; MMR diversification; select Top‑K (default 20)
- Build context with citations

## Knobs
- K (Top‑K): 10–30 typical; default 20
- MMR λ (0–1): higher favors relevance; lower favors diversity; default 0.5
- Min chunk length penalty: default 160 chars
- Slide grouping: PPTX groups of 4 to increase density
- Include/exclude folders for scope control

## Advanced
- Path-based boosts/penalties (e.g., downweight `Welcome.md`)
- Recency re-rank (prefer recently updated notes)
- Folder/tag filters in `find_similar` ("/" or blank is ignored)
- Hybrid BM25 + vector (future)
- Section metadata per chunk: `section` for headings/slide numbers, `start/end` offsets

## Debugging
- Use Debug view to inspect retrieved items
- Trace View shows tool args/results and final citations
- Export samples to audit extractors
- Scan tree to identify non-indexables
- Remember: chat is now stateful (prior messages included up to ~6k tokens)

