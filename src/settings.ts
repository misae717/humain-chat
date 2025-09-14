import { App, PluginSettingTab, Setting } from 'obsidian';
import type HumainChatPlugin from './main';

export class HumainChatSettingTab extends PluginSettingTab {
	plugin: HumainChatPlugin;

	constructor(app: App, plugin: HumainChatPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Enable plugin')
			.setDesc('Turn the chat sidebar on or off.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enabled)
				.onChange(async (value) => {
					this.plugin.settings.enabled = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto-open on start')
			.setDesc('Open the chat view when Obsidian loads.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoOpenOnStart)
				.onChange(async (value) => {
					this.plugin.settings.autoOpenOnStart = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Compact UI')
			.setDesc('Reduce paddings and font sizes.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.compactUI)
				.onChange(async (value) => {
					this.plugin.settings.compactUI = value;
					await this.plugin.saveSettings();
					this.plugin.refreshChatView();
				}));

		new Setting(containerEl)
			.setName('Accent color')
			.setDesc('CSS color for user message bubbles and accents.')
			.addText(text => text
				.setPlaceholder('e.g. #6c5ce7 or var(--interactive-accent)')
				.setValue(this.plugin.settings.accentColor)
				.onChange(async (value) => {
					this.plugin.settings.accentColor = value || 'var(--interactive-accent)';
					await this.plugin.saveSettings();
					this.plugin.refreshChatView();
				}));

		containerEl.createEl('h3', { text: 'Gradient & glass' });

		new Setting(containerEl)
			.setName('Enable gradient background')
			.setDesc('Apply a vertical green→teal gradient behind the chat.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.gradientEnabled)
				.onChange(async (value) => {
					this.plugin.settings.gradientEnabled = value;
					await this.plugin.saveSettings();
					this.plugin.refreshChatView();
				}));

		new Setting(containerEl)
			.setName('Gradient start')
			.setDesc('Top color. Ex: #a8f374')
			.addText(text => text
				.setValue(this.plugin.settings.gradientStart)
				.onChange(async (value) => {
					this.plugin.settings.gradientStart = value || '#a8f374';
					await this.plugin.saveSettings();
					this.plugin.refreshChatView();
				}));

		new Setting(containerEl)
			.setName('Gradient end')
			.setDesc('Bottom color. Ex: #00bfa5')
			.addText(text => text
				.setValue(this.plugin.settings.gradientEnd)
				.onChange(async (value) => {
					this.plugin.settings.gradientEnd = value || '#00bfa5';
					await this.plugin.saveSettings();
					this.plugin.refreshChatView();
				}));

		new Setting(containerEl)
			.setName('Gradient angle')
			.setDesc('CSS angle (e.g. 180deg).')
			.addText(text => text
				.setValue(this.plugin.settings.gradientAngle)
				.onChange(async (value) => {
					this.plugin.settings.gradientAngle = value || '180deg';
					await this.plugin.saveSettings();
					this.plugin.refreshChatView();
				}));

		new Setting(containerEl)
			.setName('Glass blur')
			.setDesc('Backdrop-filter blur amount (e.g. 10px).')
			.addText(text => text
				.setValue(this.plugin.settings.glassBlur)
				.onChange(async (value) => {
					this.plugin.settings.glassBlur = value || '10px';
					await this.plugin.saveSettings();
					this.plugin.refreshChatView();
				}));

		new Setting(containerEl)
			.setName('Glass opacity')
			.setDesc('0 to 1, controls translucency of chat container.')
			.addText(text => text
				.setValue(this.plugin.settings.glassOpacity)
				.onChange(async (value) => {
					this.plugin.settings.glassOpacity = value || '0.65';
					await this.plugin.saveSettings();
					this.plugin.refreshChatView();
				}));

		new Setting(containerEl)
			.setName('Animated gradient')
			.setDesc('Subtle movement across the background gradient.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.animatedGradient)
				.onChange(async (value) => {
					this.plugin.settings.animatedGradient = value;
					await this.plugin.saveSettings();
					this.plugin.refreshChatView();
				}));
	}
}


