import { ItemView, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_CHAT } from '../types';
// @ts-ignore - esbuild loads .svg as raw text
import logoSvg from './logo.svg';

export class ChatView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_CHAT;
	}

	getDisplayText(): string {
		return 'HUMAIN Chat';
	}

	getIcon(): string {
		return 'message-square';
	}

	async onOpen() {
		const root = this.contentEl;
		root.addClass('humain-chat-view');

		const header = root.createEl('div', { cls: 'humain-chat-header' });
		const brand = header.createEl('div', { cls: 'humain-logo' });
		brand.innerHTML = (logoSvg as unknown as string);

		// Animation preference from plugin settings (no direct import to avoid cycles)
		const plugin: any = (this.app as any).plugins?.getPlugin?.('humain-chat');
		const animated = !!plugin?.settings?.animatedGradient;
		const ocean = !!plugin?.settings?.oceanEnabled;
		const noise = !!plugin?.settings?.noiseEnabled;
		if (animated) root.addClass('humain-gradient-animated');
		if (ocean) root.addClass('humain-ocean');
		if (noise) root.addClass('humain-noise');
		if (ocean) root.createEl('div', { cls: 'humain-ocean-layer3' });
		// Removed bloom/glow to avoid visual noise and global bleed

		const messages = root.createEl('div', { cls: 'humain-chat-messages' });
		const inputRow = root.createEl('form', { cls: 'humain-chat-input-row' });
		const textarea = inputRow.createEl('textarea', { cls: 'humain-chat-textarea', attr: { placeholder: 'Type a message…' } });
		const sendBtn = inputRow.createEl('button', { cls: 'humain-chat-send', text: 'Send', attr: { type: 'submit' } });
		if (animated) sendBtn.addClass('anim');

		inputRow.addEventListener('submit', async (e) => {
			e.preventDefault();
			const text = textarea.value.trim();
			if (!text) return;
			this.appendMessage(messages, text, 'user');
			textarea.value = '';
			const placeholder = this.appendMessage(messages, '…', 'assistant');
			messages.scrollTop = messages.scrollHeight;

			try {
				const reply = await this.callOpenAI(text);
				placeholder.setText(reply || '');
			} catch (err) {
				placeholder.setText('Error contacting OpenAI');
			}
			messages.scrollTop = messages.scrollHeight;
		});
	}

	private appendMessage(container: HTMLElement, text: string, role: 'user' | 'assistant') {
		const row = container.createEl('div', { cls: `humain-chat-row role-${role}` });
		const el = row.createEl('div', { cls: 'humain-chat-bubble humain-bubble-in', text });
		return el;
	}

	private async callOpenAI(userContent: string): Promise<string> {
		const plugin: any = (this.app as any).plugins?.getPlugin?.('humain-chat');
		const settings = plugin?.settings || {};
		const apiKey: string = settings.openAIApiKey || '';
		const baseUrl: string = (settings.openAIBaseUrl || 'https://api.openai.com').replace(/\/$/, '');
		const model: string = settings.openAIModel || 'gpt-4o-mini';
		if (!apiKey) throw new Error('Missing OpenAI API key. Set it in Settings → HUMAIN Chat.');

		const url = `${baseUrl}/v1/chat/completions`;
		const resp = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				messages: [
					{ role: 'system', content: 'You are HUMAIN Chat inside Obsidian. Be concise.' },
					{ role: 'user', content: userContent },
				],
				stream: false,
				temperature: 0.3,
			}),
		});
		if (!resp.ok) throw new Error(`OpenAI HTTP ${resp.status}`);
		const json = await resp.json();
		return json?.choices?.[0]?.message?.content || '';
	}

	async onClose() {
		this.contentEl.empty();
	}
}


