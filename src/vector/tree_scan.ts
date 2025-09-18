import type HumainChatPlugin from '../main';

export async function scanIndexableTree(plugin: HumainChatPlugin): Promise<string> {
  const vault: any = plugin.app.vault;
  const files: any[] = vault.getFiles();
  const include = (plugin.settings.indexIncludeFolders || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const exclude = (plugin.settings.indexExcludeFolders || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const inScope = (p: string) => {
    if (exclude.some(x => p.startsWith(x + '/'))) return false;
    if (include.length === 0) return true;
    return include.some(x => p.startsWith(x + '/'));
  };

  const indexableExt = new Set(['md','pdf','docx','pptx']);
  const byFolder: Record<string, { path: string; ext: string; indexable: boolean }[]> = {};
  const nonIndexable: { path: string; ext: string }[] = [];

  for (const f of files) {
    if (!inScope(f.path)) continue;
    const ext = String(f.extension || '').toLowerCase();
    const entry = { path: f.path, ext, indexable: indexableExt.has(ext) };
    const folder = f.parent?.path || '/';
    byFolder[folder] = byFolder[folder] || [];
    byFolder[folder].push(entry);
    if (!entry.indexable) nonIndexable.push({ path: f.path, ext });
  }

  const lines: string[] = [];
  lines.push('# HUMAIN Tree Scan');
  for (const folder of Object.keys(byFolder).sort()) {
    lines.push(`\n## ${folder}`);
    for (const e of byFolder[folder].sort((a,b)=> a.path.localeCompare(b.path))) {
      lines.push(`- ${e.indexable ? '[✓]' : '[×]'} ${e.path} (${e.ext || 'noext'})`);
    }
  }
  if (nonIndexable.length) {
    const kinds = Array.from(new Set(nonIndexable.map(n => n.ext || 'noext'))).sort();
    lines.push(`\n## Non-indexable extensions`);
    lines.push(kinds.map(k => `- ${k}`).join('\n'));
  }
  return lines.join('\n');
}




