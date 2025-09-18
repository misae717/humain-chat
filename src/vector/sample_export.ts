import type HumainChatPlugin from '../main';
import { extractIfSupported } from './extractors';

export async function exportRandomSamples(plugin: HumainChatPlugin): Promise<string> {
  const vault = plugin.app.vault as any;
  const files: any[] = vault.getFiles();
  const groups = {
    docx: files.filter(f => /\.docx$/i.test(f.path)),
    pptx: files.filter(f => /\.pptx$/i.test(f.path)),
    pdf: files.filter(f => /\.pdf$/i.test(f.path)),
  };
  function pick3(arr: any[]) {
    const copy = [...arr];
    copy.sort(() => Math.random() - 0.5);
    return copy.slice(0, Math.min(3, copy.length));
  }
  const selected = [...pick3(groups.docx), ...pick3(groups.pptx), ...pick3(groups.pdf)];
  const outDir = '.humain-extractor-samples';
  const adapter: any = vault.adapter;
  const exists = await adapter.exists(outDir);
  if (!exists) await adapter.mkdir(outDir);
  for (const f of selected) {
    const ex = await extractIfSupported(plugin, f);
    const text = ex?.text || '';
    const base = f.path.replace(/[\\/:*?"<>|]/g, '_');
    const outPath = `${outDir}/${base}.txt`;
    await adapter.write(outPath, text);
  }
  return outDir;
}




