import type HumainChatPlugin from '../main';

export interface VaultOutlineOptions { maxFolders?: number; maxChars?: number }

let cached: { text: string; ts: number } | null = null;

export function getVaultOutline(plugin: HumainChatPlugin, opts?: VaultOutlineOptions): string {
  const maxFolders = Math.max(1, Math.min(200, opts?.maxFolders ?? 60));
  const maxChars = Math.max(500, Math.min(20000, opts?.maxChars ?? 6000));
  const now = Date.now();
  if (cached && (now - cached.ts) < 60_000) {
    return cached.text;
  }
  try {
    const vault: any = (plugin.app as any).vault;
    const files: any[] = vault.getFiles();
    const counts: Record<string, { md: number; pdf: number; docx: number; pptx: number; other: number }> = {};
    for (const f of files) {
      const folder = f.parent?.path || '/';
      counts[folder] = counts[folder] || { md: 0, pdf: 0, docx: 0, pptx: 0, other: 0 };
      const ext = String(f.extension || '').toLowerCase();
      if (ext === 'md') counts[folder].md++;
      else if (ext === 'pdf') counts[folder].pdf++;
      else if (ext === 'docx') counts[folder].docx++;
      else if (ext === 'pptx') counts[folder].pptx++;
      else counts[folder].other++;
    }
    const lines: string[] = [];
    const folders = Object.keys(counts).sort();
    for (const folder of folders.slice(0, maxFolders)) {
      const c = counts[folder];
      lines.push(`- ${folder} (md:${c.md}, pdf:${c.pdf}, docx:${c.docx}, pptx:${c.pptx}, other:${c.other})`);
    }
    let text = lines.join('\n');
    if (text.length > maxChars) text = text.slice(0, maxChars);
    cached = { text, ts: now };
    return text;
  } catch {
    return '';
  }
}

export function clearOutlineCache() { cached = null; }


