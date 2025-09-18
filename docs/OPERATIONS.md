# Operations & Maintenance

## Common Tasks
- Install deps: `npm install`; Dev build: `npm run dev`; Prod build: `npm run build`
- Open Chat: ribbon icon or command palette
- Rebuild Index: command palette → “Rebuild HUMAIN Embeddings Index”
- Debug View: command palette → “Open HUMAIN Debug View”
- Tree Scan: command palette → “Scan indexable tree and log non-indexables”
- Sample Export: command palette → “Export 3× DOCX/PPTX/PDF samples for review”

## Troubleshooting
- Embeddings truncation in Ollama: reduce chunk size (defaults target ~700 tokens); grouping applied for PPTX
- Missing vectors: confirm Ollama host/model; pull model; check `/api/embed`
- No progress UI: use Debug view + status bar; rebuild prevents concurrency
- JSONL index corruption: delete index files in index dir and rebuild

## Backups
- Index directory `.humain-index` can be regenerated; backup not required
- Keep extractor samples for regression comparisons when tuning

## Performance Tips
- Use include/exclude folders for scope
- Batch rebuilds off-hours; avoid frequent full runs—incremental hashing is enabled
- Consider lighter/faster embedding models for large corpora

