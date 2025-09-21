import { ItemView, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_CHAT } from '../types';
import type HumainChatPlugin from '../main';
import { searchSimilar } from '../vector/rag';
import { extractIfSupported } from '../vector/extractors';
import { appendDebug, debugEvent } from './debugView';
import { MarkdownRenderer } from 'obsidian';
// @ts-ignore - esbuild loads .svg as raw text
import logoSvg from './logo.svg';

export class ChatView extends ItemView {
	private conversation: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
	private statusBar?: HTMLElement;
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.conversation = [{ role: 'system', content: 'You are HUMAIN Chat inside Obsidian. Be concise and helpful.' }];
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

		this.statusBar = root.createEl('div', { cls: 'humain-chat-status' });
		const messages = root.createEl('div', { cls: 'humain-chat-messages' });
		const inputRow = root.createEl('form', { cls: 'humain-chat-input-row' });
		const textarea = inputRow.createEl('textarea', { cls: 'humain-chat-textarea', attr: { placeholder: 'Type a message…' } });
		textarea.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				inputRow.requestSubmit();
			}
		});
		const sendBtn = inputRow.createEl('button', { cls: 'humain-chat-send', text: 'Send', attr: { type: 'submit' } });
		if (animated) sendBtn.addClass('anim');

        inputRow.addEventListener('submit', async (e) => {
			e.preventDefault();
			const text = textarea.value.trim();
			if (!text) return;
			sendBtn.setAttr('disabled', 'true');
			this.appendMessage(messages, text, 'user');
			this.conversation.push({ role: 'user', content: text });
			textarea.value = '';
			const placeholder = this.appendMessage(messages, '…', 'assistant');
			messages.scrollTop = messages.scrollHeight;

			try {
				await this.runAgentFlowLangGraph(text, placeholder);
			} catch (err: any) {
				console.error('Agent error', err);
				placeholder.setText(`Agent error: ${err?.message || String(err)}`);
				debugEvent('error', 'Agent crashed', { message: err?.message || String(err) });
			}
			messages.scrollTop = messages.scrollHeight;
			sendBtn.removeAttribute('disabled');
		});
	}

	private appendMessage(container: HTMLElement, text: string, role: 'user' | 'assistant', extraCls?: string) {
		const row = container.createEl('div', { cls: `humain-chat-row role-${role}` });
		const el = row.createEl('div', { cls: `humain-chat-bubble humain-bubble-in markdown-rendered ${extraCls || ''}` });
		this.renderMarkdownTo(el, text);
		return el;
	}

	private renderMarkdownTo(target: HTMLElement, markdown: string) {
		try {
			target.empty();
			const srcPath = this.app.workspace.getActiveFile()?.path || '/';
			(MarkdownRenderer as any).renderMarkdown(markdown, target, srcPath, this);
		} catch (_) {
			target.setText(markdown);
		}
	}

	private postprocessAssistant(text: string): string {
		const exts = ['md','pdf','pptx','docx'];
		const re = /\[([^\[\]\n]+\.(?:md|pdf|pptx|docx))\]/g;
		return text.replace(re, (_m: string, p1: string) => {
			const p = (p1 || '').trim();
			if (!p) return _m;
			const ext = p.split('.').pop()?.toLowerCase();
			if (!ext || !exts.includes(ext)) return _m;
			return `[[${p}]]`;
		});
	}



	private pushStatus(text: string): HTMLElement {
		const el = this.statusBar?.createEl('span', { cls: 'humain-status-chip', text }) as HTMLElement;
		return el;
	}

	private updateStatus(el: HTMLElement, text: string) { try { el.setText(text); } catch {} }

	// Agent loop: model decides tool calls; tools return JSON; final answer is streamed
	private async runAgentFlow(userText: string, placeholder: HTMLElement) {
		const plugin: any = (this.app as any).plugins?.getPlugin?.('humain-chat');
		const settings = plugin?.settings || {};
		const thinkUI = !!settings.thinkingIndicators;
		const showReasoning = !!settings.showReasoning;
		const maxSteps = Math.max(1, Math.min(8, settings.maxToolCalls ?? 3));

		// Reset per-turn step counter for logs
		(this as any)._stepCount = 0;
		const turnId = `turn_${Date.now().toString(36)}_${Math.floor(Math.random()*1e6).toString(36)}`;

		let step = 0;
		let thinkingBubble: HTMLElement | undefined;
		let thinkingDetails: HTMLElement | undefined;
		let summaryEl: HTMLElement | undefined;

		const messagesContainer = placeholder.parentElement?.parentElement;
		if (!messagesContainer) return;

		if (showReasoning) {
			thinkingBubble = this.appendMessage(messagesContainer, '', 'assistant', 'humain-thinking-bubble');
			const details = thinkingBubble.createEl('details', { cls: 'humain-thinking-details' });
			details.open = true;
			summaryEl = details.createEl('summary', { text: 'Thinking…' });
			thinkingDetails = details.createEl('div');
			placeholder.remove();
		}

		// Conversation scaffolding separate from UI conversation
		type Msg = { role: 'system' | 'user' | 'assistant' | 'developer'; content: string; name?: string };
		const agentMessages: Msg[] = [];
		agentMessages.push({ role: 'system', content: 'You are a reasoning agent for an Obsidian vault backed by semantic search (embeddings + vector database). Behavior: (1) Understand the user goal; (2) Plan compact, high-signal queries (3-8 variants) that disambiguate names, acronyms, and synonyms; (3) Call tools to gather evidence (cap K=5); (4) Analyze evidence; (5) Provide a final answer with citations. Tool phase output MUST be a single JSON object {"tool_call":{...}} and NOTHING ELSE. When you have enough evidence or the search is unproductive, DO NOT call tools—return the final answer in prose.' });
		agentMessages.push({ role: 'developer' as any, content: 'TOOLS: find_similar({ queries: string[], k?: number }); read_note({ note_path: string, max_chars?: number }). POLICY: Auto-execute searches; do not ask permission. Cap K at 5. If a tool returns no results, do not retry with trivial variations; explain the gap succinctly instead. Never mix prose and tool calls in the same response.' } as any);
		
		// Add vault outline ONCE at the beginning
		try {
			const outline = this.buildVaultOutline(24, 4000);
			if (outline) agentMessages.push({ role: 'system', content: `Vault outline (high-level):\n${outline}` });
		} catch {}
		
		agentMessages.push({ role: 'system', content: `TURN_ID: ${turnId}` });
		agentMessages.push({ role: 'user', content: userText });

		if (summaryEl) summaryEl.setText('Planning…');

		while (step < maxSteps) {
			step++;
			if (summaryEl) summaryEl.setText(`Step ${step}: Thinking…`);
			const resp = await this.callModelNonStreaming(agentMessages);
			const raw = resp?.content || '';
			const tc = this.tryParseToolCall(raw);
			
			if (!tc || !tc.name) {
				// Final answer generation
				if (thinkingBubble) thinkingBubble.remove();
				const finalPlaceholder = this.appendMessage(messagesContainer, '…', 'assistant');
				agentMessages.push({ role: 'system', content: 'You have finished tool use for this turn. Provide a concise, self-contained answer. Include citations where applicable. Do NOT call any more tools.' });
				const finalAnswer = await this.callModelNonStreaming(agentMessages).then(r => r.content || '');
				this.renderMarkdownTo(finalPlaceholder, finalAnswer);
				this.conversation.push({ role: 'user', content: userText });
				this.conversation.push({ role: 'assistant', content: finalAnswer });
				return;
			}

			if (summaryEl) summaryEl.setText(`Step ${step}: Searching with \`${tc.name}\``);
			if (thinkingDetails) thinkingDetails.createEl('pre', { cls: 'humain-tool-call', text: `> Tool Call: ${JSON.stringify(tc, null, 2)}` });

			let toolResult: any = { ok: true, data: null };
			try {
				if (tc.name === 'find_similar') {
					toolResult = { ok: true, data: await searchSimilar(plugin as any, tc.arguments || {}) };
				} else if (tc.name === 'read_note') {
					const arg = tc.arguments || {};
					toolResult = { ok: true, data: await this.readNoteTool(arg?.note_path, arg) };
				} else {
					toolResult = { ok: false, error: 'Unknown tool' };
				}
			} catch (e: any) {
				toolResult = { ok: false, error: e?.message || String(e) };
			}

			if (thinkingDetails) thinkingDetails.createEl('pre', { cls: 'humain-tool-result', text: `< Tool Result: ${JSON.stringify(toolResult)}` });
			
			// Early stop if retrieval is empty to avoid unproductive loops
			if (tc.name === 'find_similar' && (!toolResult?.ok || !Array.isArray(toolResult?.data) || toolResult.data.length === 0)) {
				if (summaryEl) summaryEl.setText(`Step ${step}: No results, answering`);
				agentMessages.push({ role: 'system', content: 'Search returned no usable results. Provide your best answer without calling more tools.' });
				break;
			}

			// Summarize the tool result for the model to reduce context bloat
			const summarized = this.summarizeToolResult(tc.name, toolResult);
			agentMessages.push({ role: 'assistant', content: JSON.stringify({ tool_call: { name: tc.name, arguments: tc.arguments || {} } }) });
			agentMessages.push({ role: 'system', content: JSON.stringify({ tool_result: summarized }) });
		}

		if (thinkingBubble) thinkingBubble.remove();
		const finalFallbackPlaceholder = this.appendMessage(messagesContainer, '…', 'assistant');
		// Loop exhausted, ask for a final answer
		agentMessages.push({ role: 'system', content: 'You have reached the maximum number of tool calls. Provide a final answer based on gathered evidence. Do NOT call any more tools.' });
		const final = await this.callModelNonStreaming(agentMessages).then(r => r.content || '');
		this.renderMarkdownTo(finalFallbackPlaceholder, final);
		this.conversation.push({ role: 'user', content: userText });
		this.conversation.push({ role: 'assistant', content: final });
	}

    private tryParseToolCall(text: string): { name: string; arguments: any } | null {
        // 1) Exact JSON only
        try {
            const obj = JSON.parse(text);
            const t = obj?.tool_call || null;
            if (t && (typeof t.name === 'string' || typeof (t.tool_name) === 'string')) {
                return { name: String(t.name || t.tool_name), arguments: t.arguments || {} };
            }
        } catch {}

        // 2) Extract first JSON object that contains "tool_call" even if mixed with prose or fenced code
        const candidate = this.extractJsonObjectContaining(text, '"tool_call"');
        if (candidate) {
            try {
                const obj = JSON.parse(candidate);
                const t = obj?.tool_call || null;
                if (t && (typeof t.name === 'string' || typeof (t.tool_name) === 'string')) {
                    return { name: String(t.name || t.tool_name), arguments: t.arguments || {} };
                }
            } catch {}
        }
        return null;
    }

    private summarizeToolResult(name: string, result: any): any {
		const safe = (x: any) => {
			try { return JSON.parse(JSON.stringify(x)); } catch { return { ok: false, error: 'unserializable' }; }
		};
		if (!result || !result.ok) return { name, ok: false, error: String(result?.error || 'unknown') };
		if (name === 'find_similar') {
			const items = Array.isArray(result.data) ? result.data.slice(0, 5) : [];
			return { name, ok: true, count: items.length, top: items.map((d: any) => ({ path: d.path, score: d.score, snippet: typeof d.snippet === 'string' ? d.snippet.slice(0, 300) : '' })) };
		}
		if (name === 'read_note') {
			const text = String(result?.data?.text || '');
			return { name, ok: true, path: result?.data?.path, preview: text.slice(0, 600) };
		}
		return safe({ name, ok: true, data: result?.data });
	}

    private extractJsonObjectContaining(source: string, mustContain: string): string | null {
        const s = source || '';
        // Try to narrow to code fences first
        const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
        let m: RegExpExecArray | null;
        while ((m = fenceRe.exec(s))) {
            const inner = (m[1] || '').trim();
            if (inner.includes(mustContain)) {
                const balanced = this.extractBalancedJson(inner);
                if (balanced) return balanced;
                try { JSON.parse(inner); return inner; } catch {}
            }
        }
        // Fallback: scan whole text for first balanced { ... } containing the key
        return this.extractBalancedJson(s, mustContain);
    }

    private extractBalancedJson(text: string, mustContain?: string): string | null {
        const n = text.length;
        for (let i = 0; i < n; i++) {
            if (text[i] !== '{') continue;
            let depth = 0;
            let inStr = false;
            let esc = false;
            for (let j = i; j < n; j++) {
                const ch = text[j];
                if (inStr) {
                    if (esc) { esc = false; continue; }
                    if (ch === '\\') { esc = true; continue; }
                    if (ch === '"') inStr = false;
                } else {
                    if (ch === '"') inStr = true;
                    else if (ch === '{') depth++;
                    else if (ch === '}') {
                        depth--;
                        if (depth === 0) {
                            const slice = text.slice(i, j + 1);
                            if (!mustContain || slice.includes(mustContain)) return slice;
                            break;
                        }
                    }
                }
            }
        }
        return null;
    }

	private async readNoteTool(path?: string, opts?: any): Promise<{ path: string; text: string }> {
		if (!path) return { path: '', text: '' };
		const vault: any = (this.app as any).vault;
		const file: any = vault.getAbstractFileByPath(path);
		if (!file) return { path, text: '' };
		let text = '';
		if (String(file.extension || '').toLowerCase() === 'md') {
			text = await vault.read(file);
		} else {
			const plugin: any = (this.app as any).plugins?.getPlugin?.('humain-chat');
			const ex = await extractIfSupported(plugin as any, file);
			text = ex?.text || '';
		}
		const max = Math.max(0, Math.min(20000, Number(opts?.max_chars || 4000)));
		if (max && text.length > max) text = text.slice(0, max);
		return { path, text };
	}

	private async callModelNonStreaming(messages: Array<{ role: string; content: string; name?: string }>): Promise<{ content: string }> {
		const plugin: any = (this.app as any).plugins?.getPlugin?.('humain-chat');
		const settings = plugin?.settings || {};
		const apiKey: string = settings.openAIApiKey || '';
		const baseUrl: string = (settings.openAIBaseUrl || 'https://api.openai.com').replace(/\/$/, '');
		const model: string = settings.openAIModel || 'gpt-5';
		if (!apiKey) throw new Error('Missing OpenAI API key. Set it in Settings → HUMAIN Chat.');
		const url = `${baseUrl}/v1/chat/completions`;
		
		// Clean up and structure logs
		const logMsgs = messages.map(m => ({ role: m.role, content: String(m.content).slice(0, 400) }));
		appendDebug(`[agent.step.${(this as any)._stepCount = ((this as any)._stepCount || 0) + 1}] ${new Date().toISOString()}\nTURN ${messages.find(m=>m.role==='system' && m.content.startsWith('TURN_ID'))?.content || ''}\n---\n${JSON.stringify({ model, messages: logMsgs }, null, 2)}`);

		// Ensure roles conform to OpenAI schema (no developer/tool roles)
		const sanitized = messages.map(m => ({ role: (m.role === 'developer' || m.role === 'tool') ? 'system' : (m.role as any), content: String(m.content) }));
		
		const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages: sanitized, stream: false }) });
		if (!resp.ok) {
			let errText = '';
			try { errText = await resp.text(); } catch {}
			appendDebug(`[agent.error]\nHTTP ${resp.status}\n${errText.slice(0, 2000)}`);
			throw new Error(`OpenAI HTTP ${resp.status}`);
		}
		const json = await resp.json();
		appendDebug(`[agent.response]\n---\n${JSON.stringify(json, null, 2).slice(0, 2000)}\n...`);
		return { content: json?.choices?.[0]?.message?.content || '' };
	}

	private async callModelStreamFromMessages(messages: Array<{ role: string; content: string; name?: string }>): Promise<string> {
		const plugin: any = (this.app as any).plugins?.getPlugin?.('humain-chat');
		const settings = plugin?.settings || {};
		const apiKey: string = settings.openAIApiKey || '';
		const baseUrl: string = (settings.openAIBaseUrl || 'https://api.openai.com').replace(/\/$/, '');
		const model: string = settings.openAIModel || 'gpt-5';
		if (!apiKey) throw new Error('Missing OpenAI API key. Set it in Settings → HUMAIN Chat.');
		const url = `${baseUrl}/v1/chat/completions`;
		const sanitized = messages.map(m => ({ role: (m.role === 'developer' || m.role === 'tool') ? 'system' : (m.role as any), content: String(m.content) }));
		const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages: sanitized, stream: true }) });
		if (!resp.ok || !resp.body) {
			let errText = '';
			try { errText = await resp.text(); } catch {}
			appendDebug(`[agent.error.stream]\nHTTP ${resp.status}\n${errText.slice(0, 2000)}`);
			throw new Error(`OpenAI HTTP ${resp.status}`);
		}
		// Replace streaming with one-shot non-streaming call
		const single = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages: sanitized, stream: false }) });
		if (!single.ok) throw new Error(`OpenAI HTTP ${single.status}`);
		const json = await single.json();
		return json?.choices?.[0]?.message?.content || '';
	}

	// New LangGraph-based agent
	private async runAgentFlowLangGraph(userText: string, placeholder: HTMLElement) {
		const plugin: any = (this.app as any).plugins?.getPlugin?.('humain-chat');
		const { createAgent } = await import('../agent/graph');
		const agent = await createAgent(plugin as any);
		const messagesContainer = placeholder.parentElement?.parentElement;
		if (!messagesContainer) return;
		// Build stateful context: prior conversation (token-limited), then current user
		const prior = this.buildLimitedMessages(this.conversation, 6000).filter(m => m.role !== 'system');
		const seed = [
			{ role: 'system', content: 'You are HUMAIN Chat. Be concise, cite filenames when applicable.' },
			...prior,
			{ role: 'user', content: userText }
		] as any;
		if (plugin?.settings?.includeVaultOutlineEachTurn) {
			try {
				const { getVaultOutline } = await import('../vector/tree_outline');
				const outline = getVaultOutline(plugin as any, { maxFolders: 40, maxChars: 4000 });
				if (outline) seed.unshift({ role: 'system', content: `Vault outline:\n${outline}` } as any);
			} catch {}
		}
		debugEvent('agent', 'Turn start', { userText });
		const out = await agent.runTurn(seed);
		const last = out[out.length - 1];
		const content = String((last as any)?.content || '').trim();
		this.renderMarkdownTo(placeholder, content);
		this.conversation.push({ role: 'user', content: userText });
		this.conversation.push({ role: 'assistant', content });
		debugEvent('agent', 'Turn end', { tokens: content.length });
	}

	private buildVaultOutline(maxFolders: number = 40, maxChars: number = 6000): string {
		try {
			const vault: any = (this.app as any).vault;
			const files: any[] = vault.getFiles();
			// Build a small folder→counts outline
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
			for (const folder of folders.slice(0, Math.max(1, maxFolders))) {
				const c = counts[folder];
				lines.push(`- ${folder} (md:${c.md}, pdf:${c.pdf}, docx:${c.docx}, pptx:${c.pptx}, other:${c.other})`);
			}
			let text = lines.join('\n');
			if (text.length > maxChars) text = text.slice(0, maxChars);
			return text;
		} catch { return ''; }
	}

	private buildLimitedMessages(all: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, maxTokens: number) {
		const estimate = (s: string) => Math.ceil(s.length / 4);
		let total = 0;
		const out: typeof all = [];
		const sys = all[0]?.role === 'system' ? all[0] : undefined;
		const rest = sys ? all.slice(1) : all.slice(0);
		const reversed = [...rest].reverse();
		const acc: typeof all = [];
		for (const m of reversed) {
			const t = estimate(m.content) + 4;
			if (total + t > maxTokens) break;
			total += t;
			acc.push(m);
		}
		acc.reverse();
		if (sys) {
			const tSys = estimate(sys.content) + 4;
			if (total + tSys <= maxTokens) {
				out.push(sys);
			}
		}
		out.push(...acc);
		return out;
	}

	async onClose() {
		this.contentEl.empty();
	}
}


