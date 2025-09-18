# UI Guide (Chat, Debug, Indexing)

## Chat
- Markdown rendered bubbles; links and lists supported
- Current date/time injected; context citations shown above implicitly
- Planned: clickable file chips (open note/file within Obsidian), code/table styles

## Debug View
- Logs retrieval context, OpenAI requests/responses, and errors
- Text is selectable/editable to ease sharing
- Planned: indexing pane with progress bar and cancel button

## Indexing UX
- Background job with lock; percent shown in status bar
- Rebuild command prevents concurrent runs; logs progress to Debug view
- Tree Scan command: prints indexable vs non-indexable tree and extensions
- Sample Export command: writes 3× per type to `.humain-extractor-samples`

## Settings Hints
- Retrieval Top‑K: 20 (raise for breadth)
- Chunk size/overlap: ~2800/400 chars
- Enable extractors as needed; review samples before full rebuild

