### EmbeddingGemma:300M local embeddings benchmark (Windows)
  THIS README WAS PULLED FROM A DIFFERENT REPO, AND IS NOT REPRESENTATIVE, USE IT AS A REFERENCE ONLY FOR THE API ENDPOINT FOR OLLAMA.
We will be using the Ollama embeddings endpoint with `embeddinggemma:300m` and friends.

Reference: [Ollama – Embedding models](https://ollama.com/blog/embedding-models)

---

### Prerequisites
- Ollama running locally (`http://127.0.0.1:11434`)
- Pull the embedding model you want to test:

```bash
ollama pull embeddinggemma:300m
```

---

### What the script does
- Calls Ollama’s embeddings API at `/api/embed` (per the blog docs)
- Measures latency for a generated input of approximately N tokens
- Reports vector dimension, min/avg/max latency, and an estimated tokens/sec (chars/4 ≈ tokens)
- Supports batching multiple inputs in one request to simulate larger workloads

---

### Run the benchmark
From the repository directory:

```bash
# 512 tokens, 3 trials
node bench_ollama_embeddings.js --tokens 512 --trials 3 --model embeddinggemma:300m

# ~2048 tokens (approx model context), 3 trials
node bench_ollama_embeddings.js --tokens 2048 --trials 3 --model embeddinggemma:300m

# ~8196 tokens total via 4 inputs (batching), 3 trials
node bench_ollama_embeddings.js --tokens 8196 --trials 3 --model embeddinggemma:300m --batch 4

# Debug mode prints response keys and embedding length
node bench_ollama_embeddings.js --tokens 512 --trials 1 --model embeddinggemma:300m --debug
```

Options:
- `--tokens <int>`: approximate token count (uses chars/4 heuristic)
- `--trials <int>`: number of timed runs (warm‑up + trials)
- `--model <name>`: ollama model name (default `embeddinggemma:300m`)
- `--host <ip>` and `--port <int>`: server (default `127.0.0.1:11434`)
- `--batch <int>`: duplicate the same input `batch` times in one request
- `--debug`: print extra response details

---

### Notes
- Endpoint: this uses `/api/embed`, not `/api/embeddings` (see blog docs).
- Context limits: the model’s context is ~2048 tokens. Use `--batch` to simulate large totals by sending multiple inputs in one call.
- Vector size: for `embeddinggemma:300m`, the returned embedding dimension is typically 768 (confirmed locally).
- Token estimate: the script approximates tokens as `input.length / 4` for English; real tokenizers vary.

---

### Example results (your machine may differ)
- 512 tokens: ~200–350 ms avg
- 2048 tokens: ~300–400 ms avg
- 8196 tokens via `--batch 4`: ~1.2–1.4 s total per call

These are CPU‑only figures on Windows. Throughput is good enough for Obsidian‑scale indexing using 500–800 token chunks batched 4–8 at a time.

---

### Troubleshooting
- Make sure Ollama is running and the model is pulled:

```bash
curl http://127.0.0.1:11434/api/version
curl http://127.0.0.1:11434/api/tags
```

- If you previously used `/api/embeddings`, switch to `/api/embed`.
- If you still get empty vectors, repull the model and retry:

```bash
ollama pull embeddinggemma:300m
```


