import { Plugin, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, HumainChatSettings, VIEW_TYPE_CHAT, VIEW_TYPE_DEBUG } from './types';
import { ChatView } from './ui/chatView';
import { DebugView } from './ui/debugView';
import { TraceView } from './ui/traceView';
import { HumainChatSettingTab } from './settings';
import { registerCommands } from './commands';
import { ensureIndexInitialized } from './vector/rag';

export default class HumainChatPlugin extends Plugin {
	settings: HumainChatSettings;
	private _indexing?: { running: boolean; processed: number; total: number; note?: string };
	private _statusEl?: HTMLElement;

	async onload() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		// Migrate old model names to 'gpt-5'
		const legacy = ['gpt-5-chat-latest','gpt-5-2025-08-07'];
		if (!this.settings.openAIModel || legacy.includes(this.settings.openAIModel)) {
			this.settings.openAIModel = 'gpt-5';
			try { await this.saveSettings(); } catch {}
		}
		// Force streaming off per user request
		if ((this.settings as any).streamFinalAnswer !== false) {
			(this.settings as any).streamFinalAnswer = false;
			try { await this.saveSettings(); } catch {}
		}

		this.registerView(VIEW_TYPE_CHAT, (leaf: WorkspaceLeaf) => new ChatView(leaf));
		this.registerView(VIEW_TYPE_DEBUG, (leaf: WorkspaceLeaf) => new DebugView(leaf));
		this.registerView((require('./types') as any).VIEW_TYPE_TRACE, (leaf: WorkspaceLeaf) => new TraceView(leaf));

		if (this.settings.autoOpenOnStart) {
			this.app.workspace.onLayoutReady(async () => {
				if (this.app.workspace.getLeavesOfType(VIEW_TYPE_CHAT).length === 0) {
					await this.activateChatView();
				}
			});
		}

		this.addRibbonIcon('message-square', 'Open HUMAIN Chat', async () => {
			await this.activateChatView();
		});

		registerCommands(this);
		this.addSettingTab(new HumainChatSettingTab(this.app, this));

		this.applyThemeVars();

		// Lazily prepare vector index directory
		try { await ensureIndexInitialized(this); } catch (e) { console.warn('HUMAIN index init warn', e); }

		// Prepare status bar item
		this._statusEl = this.addStatusBarItem();
		this._statusEl.setText('HUMAIN: idle');
	}

	get indexingStatus() { return this._indexing; }

	async runRebuildIndex() {
		if (this._indexing?.running) {
			// Already running, surface in debug view
			(console as any).log?.('HUMAIN: rebuild already in progress');
			return;
		}
		this._indexing = { running: true, processed: 0, total: 0 };
		this._statusEl?.setText('HUMAIN: indexing 0%');
		try {
			const { rebuildVaultIndex } = await import('./vector/rag');
			await rebuildVaultIndex(this, (u) => {
				this._indexing = { running: true, processed: u.processed, total: u.total, note: u.note };
				try { (window as any).__HUMAIN_DEBUG_APPEND__?.(`[index] ${u.processed}/${u.total}${u.note ? ' — ' + u.note : ''}`); } catch {}
				const pct = u.total ? Math.round((u.processed / u.total) * 100) : 0;
				this._statusEl?.setText(`HUMAIN: indexing ${pct}%`);
			});
		} finally {
			this._indexing = { running: false, processed: 0, total: 0 };
			this._statusEl?.setText('HUMAIN: idle');
		}
	}

	onunload() {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_CHAT)) {
			leaf.detach();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.applyThemeVars();
	}

	refreshChatView() {
		this.applyThemeVars();
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_CHAT)) {
			// Force a simple re-render by toggling a class
			leaf.view.containerEl?.toggleClass('humain-refresh', true);
			setTimeout(() => leaf.view.containerEl?.toggleClass('humain-refresh', false), 0);
		}
	}

	private applyThemeVars() {
		const root = document.body;
		root.style.setProperty('--humain-accent', this.settings.accentColor);
		root.classList.toggle('humain-compact', !!this.settings.compactUI);
		// Scope gradient classes to chat container only via CSS; no global class toggles that affect other panes
		root.style.setProperty('--humain-gradient-start', this.settings.gradientStart);
		root.style.setProperty('--humain-gradient-end', this.settings.gradientEnd);
		root.style.setProperty('--humain-gradient-angle', this.settings.gradientAngle);
		root.style.setProperty('--humain-glass-blur', this.settings.glassBlur);
		root.style.setProperty('--humain-glass-opacity', this.settings.glassOpacity);
		root.style.setProperty('--humain-ocean-intensity', String(this.settings.oceanIntensity ?? 0.6));
	}

	async activateChatView() {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_CHAT);
		if (existing.length > 0) {
			workspace.revealLeaf(existing[0]);
			// Also ensure Debug/Trace open if toggled
			await this.ensureAuxPanes();
			return;
		}
		let leaf: WorkspaceLeaf;
		// @ts-ignore
		if (typeof (workspace as any).getRightLeaf === 'function') {
			// @ts-ignore
			leaf = (workspace as any).getRightLeaf(false);
		} else {
			leaf = workspace.getLeaf(true);
		}
		await leaf.setViewState({ type: VIEW_TYPE_CHAT, active: true });
		workspace.revealLeaf(leaf);
		await this.ensureAuxPanes();
	}

	private async ensureAuxPanes() {
		try {
			if (this.settings.autoOpenDebug) {
				const leaf = this.app.workspace.getLeaf(true);
				await leaf.setViewState({ type: VIEW_TYPE_DEBUG, active: false });
			}
			if (this.settings.autoOpenTrace) {
				const leaf = this.app.workspace.getLeaf(true);
				await leaf.setViewState({ type: (require('./types') as any).VIEW_TYPE_TRACE, active: false });
			}
		} catch {}
	}
}


