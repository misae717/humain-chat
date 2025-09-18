import type HumainChatPlugin from '../main';
import { rebuildVaultIndex } from '../vector/rag';
import { Notice } from 'obsidian';
import { VIEW_TYPE_DEBUG } from '../types';
import { exportRandomSamples } from '../vector/sample_export';
import { scanIndexableTree } from '../vector/tree_scan';

export function registerCommands(plugin: HumainChatPlugin) {
	plugin.addCommand({
		id: 'humain-open-chat-view',
		name: 'Open HUMAIN Chat',
		callback: async () => {
			await plugin.activateChatView();
		},
	});

	plugin.addCommand({
		id: 'humain-rebuild-embeddings',
		name: 'Rebuild HUMAIN Embeddings Index',
		callback: async () => {
			try {
				// Debounce if already running
				if ((plugin as any).indexingStatus?.running) {
					new Notice('HUMAIN: Rebuild already in progress');
					return;
				}
				await (plugin as any).runRebuildIndex();
				new Notice('HUMAIN: Rebuilt embeddings index');
			} catch (err: any) {
				console.error('HUMAIN index rebuild error', err);
				new Notice(`HUMAIN: Index rebuild failed: ${err?.message || String(err)}`);
			}
		},
	});

	plugin.addCommand({
		id: 'humain-open-debug-view',
		name: 'Open HUMAIN Debug View',
		callback: async () => {
			const { workspace } = plugin.app;
			const leaf = workspace.getLeaf(true);
			await leaf.setViewState({ type: VIEW_TYPE_DEBUG, active: true });
			workspace.revealLeaf(leaf);
		},
	});

	plugin.addCommand({
		id: 'humain-export-extractor-samples',
		name: 'Export 3× DOCX/PPTX/PDF samples for review',
		callback: async () => {
			try {
				const out = await exportRandomSamples(plugin);
				new Notice(`HUMAIN: Exported samples to ${out}`);
			} catch (e: any) {
				console.error(e);
				new Notice(`HUMAIN: Sample export failed: ${e?.message || String(e)}`);
			}
		}
	});

	plugin.addCommand({
		id: 'humain-scan-indexable-tree',
		name: 'Scan indexable tree and log non-indexables',
		callback: async () => {
			try {
				const report = await scanIndexableTree(plugin);
				(new Notice('HUMAIN: Tree scan complete'));
				(window as any).__HUMAIN_DEBUG_APPEND__?.(report);
			} catch (e: any) {
				console.error(e);
				new Notice(`HUMAIN: Tree scan failed: ${e?.message || String(e)}`);
			}
		}
	});
}





