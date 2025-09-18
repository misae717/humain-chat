import type HumainChatPlugin from '../main';
import * as JSZip from 'jszip';
// pdfjs-dist is heavy; load lazily only when needed
let pdfjsLib: any | null = null;

export interface ExtractedDoc {
  path: string;
  mime: string;
  text: string;
}

export async function extractIfSupported(plugin: HumainChatPlugin, file: any): Promise<ExtractedDoc | null> {
  const name: string = file.path;
  if (name.toLowerCase().endsWith('.pdf')) {
    const enabled = !!(plugin as any).settings?.enablePDF;
    if (!enabled) return null;
    try { const text = await extractPDF(plugin, file); return { path: name, mime: 'application/pdf', text }; } catch { return null; }
  }
  if (name.toLowerCase().endsWith('.docx')) {
    const enabled = !!(plugin as any).settings?.enableDOCX;
    if (!enabled) return null;
    try { const text = await extractDOCX(plugin, file); return { path: name, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', text }; } catch { return null; }
  }
  if (name.toLowerCase().endsWith('.pptx')) {
    const enabled = !!(plugin as any).settings?.enablePPTX;
    if (!enabled) return null;
    try { const text = await extractPPTX(plugin, file); return { path: name, mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', text }; } catch { return null; }
  }
  return null;
}

async function readArrayBuffer(plugin: HumainChatPlugin, file: any): Promise<ArrayBuffer> {
  const adapter: any = (plugin.app as any).vault.adapter;
  // Desktop file system adapter supports readBinary
  if (typeof adapter.readBinary === 'function') {
    const buf: ArrayBuffer = await adapter.readBinary(file.path);
    return buf;
  }
  // Fallback to text and encode
  const text = await plugin.app.vault.read(file);
  return new TextEncoder().encode(text).buffer;
}

async function extractDOCX(plugin: HumainChatPlugin, file: any): Promise<string> {
  const ab = await readArrayBuffer(plugin, file);
  const zip = await JSZip.loadAsync(ab);
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) return '';
  // naive XML → text: strip tags, keep paragraphs
  const text = docXml
    .replace(/<w:p[^>]*>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+\n/g, '\n')
    .trim();
  return text;
}

async function extractPPTX(plugin: HumainChatPlugin, file: any): Promise<string> {
  const ab = await readArrayBuffer(plugin, file);
  const zip = await JSZip.loadAsync(ab);
  const slideFiles = Object.keys(zip.files).filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f));
  const sorted = slideFiles.sort();
  const groupSize = 4; // merge 4 slides per chunk to avoid tiny snippets
  const groups: string[][] = [];
  for (let i = 0; i < sorted.length; i += groupSize) groups.push(sorted.slice(i, i + groupSize));
  const out: string[] = [];
  for (const g of groups) {
    const texts: string[] = [];
    for (const sf of g) {
      const xml = await zip.file(sf)?.async('string');
      if (!xml) continue;
      const text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text) texts.push(`- ${sf}: ${text}`);
    }
    if (texts.length) out.push(texts.join('\n'));
  }
  return out.join('\n\n');
}

async function extractPDF(plugin: HumainChatPlugin, file: any): Promise<string> {
  try {
    if (!pdfjsLib) {
      // @ts-ignore
      pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
      // Use worker-less mode inside Obsidian (Electron) to avoid separate worker bundle
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }
    const ab = await readArrayBuffer(plugin, file);
    const loadingTask = pdfjsLib.getDocument({ data: ab });
    const doc = await loadingTask.promise;
    let out: string[] = [];
    const numPages = doc.numPages || 0;
    for (let p = 1; p <= numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const text = content.items.map((it: any) => it.str).join(' ');
      if (text.trim()) out.push(`# Page ${p}\n${text.trim()}`);
    }
    try { await doc.destroy(); } catch {}
    return out.join('\n\n');
  } catch {
    return '';
  }
}


