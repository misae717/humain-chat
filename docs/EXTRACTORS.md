# Extractors: PDF, DOCX, PPTX (Design & Usage)

## Supported formats (PoC)
- Markdown (.md): native via Obsidian vault
- DOCX: unzip `word/document.xml` and strip XML → paragraphs
- PPTX: unzip `ppt/slides/slide*.xml`, group 4 slides per chunk → joined text
- PDF: pdfjs-dist text extraction per page → concatenated with simple headings

## Goals
- Produce clean text for chunking/embeddings
- Be fast enough for whole-vault indexing on typical laptops
- Prefer pure-TS/JS, no native deps inside Obsidian

## Settings
- Enable/disable per format in Settings → HUMAIN Chat → Extractors
- Index directory: where JSONL index/meta are stored

## Commands
- Rebuild HUMAIN Embeddings Index: runs extractors, chunking, embeddings
- Export 3× DOCX/PPTX/PDF samples for review: writes `.humain-extractor-samples/*.txt`
- Scan indexable tree and log non-indexables: reports extension coverage

## Chunking (post-extract)
- Paragraph/sentence-aware
- Target ~700 tokens (~2800 chars) with ~100-token overlap (~400 chars)
- PPTX slides are merged in groups of 4 to avoid tiny snippets

## Quality notes
- DOCX: no style semantics; headings inferred by text position unlikely; good for simple docs
- PPTX: speaker notes not yet parsed; current chunks are slide bodies only
- PDF: complex layouts (columns/tables) degrade; consider heuristics or minimal layout inference

## Planned improvements
- PPTX notes parsing; DOCX heading/section inference
- PDF layout-aware normalization (paragraph boundaries, hyphen fixes)
- Extractor Sandbox view to preview/tune per-file extraction before indexing

## Agent use
- The agent’s `read_note`/future `read_blob` tool should transparently use extractors to read ranges/sections from non‑MD files when a deep dive is needed.

