import { Plugin, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, HumainChatSettings, VIEW_TYPE_CHAT } from './types';
import { ChatView } from './ui/chatView';
import { HumainChatSettingTab } from './settings';
import { registerCommands } from './commands';

export default class HumainChatPlugin extends Plugin {
	settings: HumainChatSettings;

	async onload() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		this.registerView(VIEW_TYPE_CHAT, (leaf: WorkspaceLeaf) => new ChatView(leaf));

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
	}

	async activateChatView() {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_CHAT);
		if (existing.length > 0) {
			workspace.revealLeaf(existing[0]);
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
	}
}


