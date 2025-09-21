import type HumainChatPlugin from '../main';
import { DEFAULT_RAG, DEFAULT_CHUNKING, HumainChatSettings } from '../types';
import * as path from 'path';
import { extractIfSupported } from './extractors';

// Simple Ollama embeddings via fetch to /api/embed
async function embedWithOllama(host: string, model: string, inputs: string[]): Promise<number[][]> {
  const url = host.replace(/\/$/, '') + '/api/embed';
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 15000);
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: inputs }) as any,
    signal: controller.signal,
  } as any).finally(() => clearTimeout(to));
  if (!(resp as any).ok) throw new Error(`Ollama embed HTTP ${ (resp as any).status }`);
  const json = await (resp as any).json();
  const vectors: number[][] = json?.embeddings || json?.data || [];
  if (!Array.isArray(vectors) || vectors.length !== inputs.length) {
    throw new Error('Unexpected embeddings response shape');
  }
  return vectors;
}

function getAdapter(plugin: HumainChatPlugin) {
  // @ts-ignore: Obsidian API
  return plugin.app.vault.adapter;
}

function debugLog(message: string, ctx?: any) {
  try { (window as any).__HUMAIN_DEBUG_APPEND__?.('retrieval', message, ctx); } catch (_) {}
}

function getSettingsWithDefaults(settings: HumainChatSettings) {
  return {
    embeddingModel: settings.embeddingModel || DEFAULT_RAG.embeddingModel,
    embeddingHost: settings.embeddingHost || DEFAULT_RAG.embeddingHost,
    lanceDbDir: settings.lanceDbDir || DEFAULT_RAG.lanceDbDir,
    ragTopK: settings.ragTopK ?? DEFAULT_RAG.ragTopK,
    indexIncludeFolders: settings.indexIncludeFolders || '',
    indexExcludeFolders: settings.indexExcludeFolders || '',
    chunkSizeChars: settings.chunkSizeChars ?? DEFAULT_CHUNKING.chunkSizeChars,
    chunkOverlapChars: settings.chunkOverlapChars ?? DEFAULT_CHUNKING.chunkOverlapChars,
    mmrLambda: (settings as any).mmrLambda ?? 0.5,
    minChunkChars: (settings as any).minChunkChars ?? 160,
  };
}

// LLM-assisted query rewriting (optional). Produces up to N focused variants.
async function generateQueryVariants(plugin: HumainChatPlugin, userQuery: string, maxVariants: number): Promise<string[]> {
  try {
    const apiKey: string = (plugin.settings as any)?.openAIApiKey || '';
    const baseUrl: string = ((plugin.settings as any)?.openAIBaseUrl || 'https://api.openai.com').replace(/\/$/, '');
    const model: string = (plugin.settings as any)?.openAIModel || 'gpt-5';
    if (!apiKey || !baseUrl || !model) return [];
    const system = 'You generate terse, high-signal search queries to retrieve notes. Return ONLY JSON: {"queries":["..."]}. No prose.';
    const prompt = `Query: ${userQuery}\nMax: ${Math.max(1, Math.min(5, maxVariants))}\nRules: diversify names/acronyms/synonyms; keep each under 12 words.`;
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ],
        stream: false
      }),
      signal: controller.signal
    } as any).finally(() => clearTimeout(to));
    if (!('ok' in (resp as any)) || !(resp as any).ok) return [];
    const json = await (resp as any).json();
    const text: string = json?.choices?.[0]?.message?.content || '';
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {
      // try to extract first JSON object
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }
    const arr: string[] = Array.isArray(parsed?.queries) ? parsed.queries : [];
    const cleaned = arr.map(s => String(s || '').trim()).filter(Boolean);
    const uniq = Array.from(new Set(cleaned));
    debugLog(`[retrieval.rewrite] produced ${uniq.length} variants`);
    return uniq.slice(0, Math.max(1, Math.min(5, maxVariants)));
  } catch (_) {
    return [];
  }
}

export async function ensureIndexInitialized(plugin: HumainChatPlugin) {
  const { lanceDbDir } = getSettingsWithDefaults(plugin.settings);
  const adapter = getAdapter(plugin);
  const exists = await adapter.exists(lanceDbDir);
  if (!exists) {
    await adapter.mkdir(lanceDbDir);
  }
  return lanceDbDir; // relative to vault
}

export interface IndexedChunk {
  id: string;
  path: string;
  content: string;
  embedding: number[];
  section?: string;
  start?: number;
  end?: number;
}

function getIndexFilePath(dir: string) { return `${dir}/index.jsonl`; }
function getMetaFilePath(dir: string) { return `${dir}/index.meta.json`; }

async function appendIndexRows(plugin: HumainChatPlugin, indexPath: string, rows: IndexedChunk[]) {
  const adapter = getAdapter(plugin);
  try {
    const existed = await adapter.exists(indexPath);
    const prev = existed ? (await adapter.read(indexPath)) : '';
    const add = rows.map(r => JSON.stringify(r)).join('\n') + '\n';
    await adapter.write(indexPath, prev + add);
  } catch (e) {
    throw new Error('Index write failed: ' + (e as any)?.message);
  }
}

async function readAllIndexRows(plugin: HumainChatPlugin, indexPath: string): Promise<IndexedChunk[]> {
  try {
    const adapter = getAdapter(plugin);
    const exists = await adapter.exists(indexPath);
    if (!exists) return [];
    const data = await adapter.read(indexPath);
    const lines = data.split(/\r?\n/).filter(Boolean);
    return lines.map(l => JSON.parse(l) as IndexedChunk);
  } catch (e) {
    return [];
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// LanceDB integration (optional). If unavailable, callers should fallback to JSONL helpers above.
async function tryOpenLanceDB(plugin: HumainChatPlugin) {
  try {
    // Use require to play nicer with CJS and native deps
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const lancedb = require('@lancedb/lancedb');
    const adapter = getAdapter(plugin);
    const basePath: string = (adapter as any).basePath || (adapter as any).getBasePath?.();
    if (!basePath) throw new Error('No vault base path');
    const { lanceDbDir } = getSettingsWithDefaults(plugin.settings);
    const abs = path.join(basePath, lanceDbDir);
    const db = await lancedb.connect(abs);
    const tableName = 'chunks';
    const names = await db.tableNames();
    const table = names.includes(tableName)
      ? await db.openTable(tableName)
      : await db.createTable(tableName, []);
    return { db, table };
  } catch (e) {
    return null;
  }
}

export async function rebuildVaultIndex(plugin: HumainChatPlugin, reporter?: (u: { processed: number; total: number; note?: string; phase?: string }) => void) {
  const { embeddingHost, embeddingModel, indexIncludeFolders, indexExcludeFolders, chunkSizeChars, chunkOverlapChars } = getSettingsWithDefaults(plugin.settings);
  const dbPath = await ensureIndexInitialized(plugin);
  const indexPath = getIndexFilePath(dbPath);
  const metaPath = getMetaFilePath(dbPath);
  // Load previous state for incremental updates
  const prevMeta = await readMeta(plugin, metaPath);
  const prevRows = await readAllIndexRows(plugin, indexPath);

  // Try LanceDB
  const lance = await tryOpenLanceDB(plugin);
  debugLog(`[index] backend: ${lance ? 'LanceDB' : 'JSONL'}`);

  // Collect files (md + supported binaries)
  const mdFiles = plugin.app.vault.getMarkdownFiles();
  const allFiles: any[] = [...mdFiles, ...plugin.app.vault.getFiles().filter((f: any) => /\.(pdf|docx|pptx)$/i.test(f.path))];
  const include = (indexIncludeFolders || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const exclude = (indexExcludeFolders || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const inScope = (path: string) => {
    if (exclude.some(x => path.startsWith(x + '/'))) return false;
    if (include.length === 0) return true;
    return include.some(x => path.startsWith(x + '/'));
  };

  const docs: { id: string; path: string; content: string }[] = [];
  for (const f of allFiles) {
    if (!inScope(f.path)) continue;
    let content = '';
    if (f.extension?.toLowerCase?.() === 'md') {
      content = await plugin.app.vault.read(f);
    } else {
      const ex = await extractIfSupported(plugin, f);
      content = ex?.text || '';
    }
    const id = `${f.path}#0`;
    docs.push({ id, path: f.path, content });
  }

  if (docs.length === 0) {
    await writeIndexRowsJsonl(plugin, indexPath, []);
    await writeMeta(plugin, metaPath, { createdAt: Date.now(), files: {} });
    return;
  }

  reporter?.({ processed: 0, total: 0, phase: 'scan' });

  // Figure out changed/new/removed
  const batchSize = 16;
  let processed = 0;
  const meta = prevMeta && prevMeta.files ? prevMeta : { files: {} } as any;
  const toEmbedDocs: { path: string; content: string; chunks: ReturnType<typeof chunkMarkdown> }[] = [];
  const keptRows: IndexedChunk[] = [];
  const seenPaths = new Set<string>();
  for (const doc of docs) {
    const chunks = chunkMarkdown(doc.content, chunkSizeChars, chunkOverlapChars, doc.path);
    const fileHash = simpleHash(doc.content);
    seenPaths.add(doc.path);
    if (meta.files[doc.path]?.hash === fileHash) {
      // unchanged: keep existing rows
      keptRows.push(...prevRows.filter(r => r.path === doc.path));
    } else {
      // changed/new
      meta.files[doc.path] = { hash: fileHash, chunks: chunks.length };
      toEmbedDocs.push({ path: doc.path, content: doc.content, chunks });
    }
  }
  // removed files: delete from meta; keptRows omits them automatically
  for (const prevPath of Object.keys(meta.files)) {
    if (!seenPaths.has(prevPath)) delete meta.files[prevPath];
  }

  const totalChunks = toEmbedDocs.reduce((a, d) => a + d.chunks.length, 0);
  reporter?.({ processed: 0, total: totalChunks, phase: 'embed' });
  const newRows: IndexedChunk[] = [];
  for (const d of toEmbedDocs) {
    for (let i = 0; i < d.chunks.length; i += batchSize) {
      const chunkBatch = d.chunks.slice(i, i + batchSize);
      const vectors = await embedWithOllama(embeddingHost, embeddingModel, chunkBatch.map(c => c.content));
      const rows = chunkBatch.map((c, j) => ({
        id: `${d.path}#${c.start}-${c.end}`,
        path: d.path,
        content: c.content,
        embedding: vectors[j],
        start: c.start,
        end: c.end,
        section: inferSection(d.path, c.content)
      }));
      newRows.push(...rows);
      processed += chunkBatch.length;
      reporter?.({ processed, total: totalChunks, note: d.path, phase: 'embed' });
      if (lance) await lance.table.add(rows);
    }
  }

  if (!lance) {
    await writeIndexRowsJsonl(plugin, indexPath, [...keptRows, ...newRows]);
  }
  await writeMeta(plugin, metaPath, meta);
  reporter?.({ processed: totalChunks, total: totalChunks, phase: 'done' });
}

export async function buildRetrievalContext(plugin: HumainChatPlugin, query: string): Promise<string> {
  const results = await searchSimilar(plugin, { mode: 'by_query', query });
  const lines: string[] = [];
  for (const it of results) {
    lines.push(`- [${it.path}]\n${it.snippet}`);
  }
  return lines.join('\n\n');
}

// Maximal Marginal Relevance diversification (simple cosine in embedding space already applied; we diversify by content difference proxy: length + id uniqueness)
function mmr(scored: { r: IndexedChunk; score: number }[], k: number, lambda: number) {
  const selected: { r: IndexedChunk; score: number }[] = [];
  const pool = [...scored].sort((a, b) => b.score - a.score);
  while (selected.length < k && pool.length) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const cand = pool[i];
      const simToSel = selected.length ? Math.max(...selected.map(s => jaccardApprox(s.r.content, cand.r.content))) : 0;
      const val = lambda * cand.score - (1 - lambda) * simToSel;
      if (val > bestVal) { bestVal = val; bestIdx = i; }
    }
    selected.push(pool.splice(bestIdx, 1)[0]);
  }
  return selected;
}

function jaccardApprox(a?: string, b?: string) {
  if (!a || !b) return 0;
  const ta = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const tb = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const uni = ta.size + tb.size - inter;
  return uni ? inter / uni : 0;
}

export interface SearchSimilarInput {
  mode: 'by_query' | 'by_note';
  query?: string;
  note_path?: string;
  k?: number;
  filter?: { folder?: string; tag?: string };
  queries?: string[]; // optional multi-query mode
}

export interface SearchSimilarResult { path: string; section?: string; score: number; snippet: string }

export async function searchSimilar(plugin: HumainChatPlugin, input: SearchSimilarInput): Promise<SearchSimilarResult[]> {
  const { embeddingHost, embeddingModel, ragTopK, mmrLambda, minChunkChars } = getSettingsWithDefaults(plugin.settings);
  const dbPath = await ensureIndexInitialized(plugin);
  const indexPath = getIndexFilePath(dbPath);

  let queryText = input.query || '';
  if (input.mode === 'by_note' && input.note_path) {
    try {
      const f = plugin.app.vault.getAbstractFileByPath(input.note_path) as any;
      if (f && f.extension?.toLowerCase?.() === 'md') {
        queryText = await plugin.app.vault.read(f);
      } else {
        // Fallback: if not md, skip full doc; require caller to use extractors in a dedicated tool
        queryText = input.note_path;
      }
    } catch { queryText = input.note_path || ''; }
  }

  let queries: string[];
  if (Array.isArray(input.queries) && input.queries.length) {
    queries = input.queries;
  } else {
    const base = queryText || (input.query || '');
    queries = [base];
    const wantRewrite = !!(plugin.settings as any)?.retrievalQueryRewrite && input.mode === 'by_query' && base;
    if (wantRewrite) {
      try {
        const maxQ = Math.max(1, Math.min(5, Number((plugin.settings as any)?.retrievalMaxQueries ?? 3)));
        const variants = await generateQueryVariants(plugin, base, maxQ);
        const set = new Set<string>([base, ...variants]);
        queries = Array.from(set).slice(0, maxQ);
      } catch {}
    }
  }
  const qVecs = await embedWithOllama(embeddingHost, embeddingModel, queries);
  const kCap = 5; // Hard cap K at 5
  const k = Math.max(1, Math.min(kCap, input.k ?? ragTopK));

  const lance = await tryOpenLanceDB(plugin);
  let scoredAll: { r: IndexedChunk; score: number }[] = [];
  for (const qVec of qVecs) {
    if (lance) {
      debugLog('[retrieval] backend: LanceDB');
      const results = await lance.table.search(qVec).limit(k * 3).execute();
      let items = results as any[];
      // optional folder filter post-hoc
      const f = normalizeFolderFilter(input.filter?.folder);
      if (f) items = items.filter((r: any) => String(r.path || '').startsWith(f + '/') || String(r.path || '') === f);
      const scored = items.map((r: any) => ({ r, score: 1 }));
      for (const s of scored) { if ((s.r.content?.length || 0) < minChunkChars) s.score *= 0.6; }
      scoredAll.push(...(scored as any));
    } else {
      debugLog('[retrieval] backend: JSONL');
      let rows = await readAllIndexRows(plugin, indexPath);
      const f = normalizeFolderFilter(input.filter?.folder);
      if (f) rows = rows.filter(r => String(r.path || '').startsWith(f + '/') || String(r.path || '') === f);
      if (!rows.length) return [];
      const scored = rows.map(r => ({ r, score: cosineSimilarity(qVec, r.embedding) }));
      for (const s of scored) { if ((s.r.content?.length || 0) < minChunkChars) s.score *= 0.6; }
      scoredAll.push(...scored);
    }
  }
  // Deduplicate by id/path keeping max score across queries
  const byId = new Map<string, { r: IndexedChunk; score: number }>();
  for (const s of scoredAll) {
    const id = s.r.id || `${s.r.path}#${(s.r as any).start}-${(s.r as any).end}`;
    const prev = byId.get(id);
    if (!prev || s.score > prev.score) byId.set(id, s);
  }
  const dedup = Array.from(byId.values());
  const top = mmr(dedup, k, mmrLambda);

  const out: SearchSimilarResult[] = [];
  for (const { r, score } of top) {
    out.push({ path: r.path, score, snippet: String(r.content || '').slice(0, 1200) });
  }
  return out;
}

function normalizeFolderFilter(folder?: string): string | undefined {
  if (!folder) return undefined;
  const f = folder.trim();
  if (!f || f === '/' || f === '.') return undefined;
  return f.replace(/^\/+/, '').replace(/\/+$/, '');
}

function chunkMarkdown(text: string, size: number, overlap: number, path: string) {
  // Paragraph/sentence-aware chunking with heading hints.
  // 1) Split into paragraphs by blank lines.
  const paragraphs = text.split(/\n\s*\n/);
  // 2) For each paragraph, optionally split into sentences (simple regex).
  const sentenceRegex = /(?<=[.!?])\s+(?=[A-Z\p{Lu}\d])/u;
  const units: string[] = [];
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    if (/^#{1,6}\s+/.test(trimmed)) { units.push(trimmed); continue; }
    const parts = trimmed.split(sentenceRegex).filter(Boolean);
    if (parts.length === 0) continue;
    // Rejoin very short sentences to avoid fragmentation
    let acc = '';
    for (const s of parts) {
      if ((acc + ' ' + s).trim().length < 200) acc = (acc ? acc + ' ' : '') + s.trim();
      else { if (acc) { units.push(acc); acc = ''; } units.push(s.trim()); }
    }
    if (acc) units.push(acc);
  }

  // 3) Pack units up to target size with overlap (~tokens via chars proxy)
  const chunks: { content: string; start: number; end: number }[] = [];
  let buf: string[] = [];
  let startIdx = 0;
  const pushChunk = (endIdx: number) => {
    const content = buf.join('\n');
    chunks.push({ content, start: startIdx, end: endIdx });
  };
  for (let i = 0; i < units.length; i++) {
    const piece = units[i];
    const next = (buf.concat(piece)).join('\n');
    if (next.length > size && buf.length > 0) {
      // finalize current
      pushChunk(i - 1);
      // overlap by tail chars
      const joined = buf.join('\n');
      const tail = joined.slice(-overlap);
      buf = tail ? [tail, piece] : [piece];
      startIdx = Math.max(0, i - 1);
    } else {
      buf.push(piece);
    }
  }
  if (buf.length) pushChunk(units.length - 1);

  // Fallback if no units
  if (chunks.length === 0 && text.trim()) {
    for (let i = 0; i < text.length; i += (size - overlap)) {
      const slice = text.slice(i, i + size);
      if (slice) chunks.push({ content: slice, start: i, end: i + slice.length });
    }
  }
  return chunks;
}

function inferSection(path: string, content: string): string | undefined {
  if (/\.pptx$/i.test(path)) {
    const m = content.match(/^\-\s*ppt\/slides\/slide(\d+)\.xml/i);
    if (m) return `slide:${m[1]}`;
  }
  if (/^#\s+/.test(content.trim())) {
    const line = content.trim().split(/\n/)[0];
    return line.replace(/^#+\s*/, '').slice(0, 80);
  }
  return undefined;
}

// Incremental metadata helpers
async function readMeta(plugin: HumainChatPlugin, metaPath: string): Promise<{ createdAt?: number; files: Record<string, { hash: string; chunks: number }> }> {
  try {
    const adapter = getAdapter(plugin);
    const exists = await adapter.exists(metaPath);
    if (!exists) return { files: {} } as any;
    const data = await adapter.read(metaPath);
    return JSON.parse(data);
  } catch (_) { return { files: {} } as any; }
}

async function writeMeta(plugin: HumainChatPlugin, metaPath: string, meta: any) {
  try { await getAdapter(plugin).write(metaPath, JSON.stringify(meta, null, 2)); } catch (_) {}
}

function simpleHash(s: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ('0000000' + (h >>> 0).toString(16)).slice(-8);
}

async function writeIndexRowsJsonl(plugin: HumainChatPlugin, indexPath: string, rows: IndexedChunk[]) {
  const adapter = getAdapter(plugin);
  const content = rows.map(r => JSON.stringify(r)).join('\n');
  await adapter.write(indexPath, content ? content + '\n' : '');
}


