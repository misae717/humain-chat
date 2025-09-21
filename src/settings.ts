import { App, PluginSettingTab, Setting } from 'obsidian';
import type HumainChatPlugin from './main';
import { DEFAULT_RAG, DEFAULT_CHUNKING } from './types';

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

		containerEl.createEl('h3', { text: 'OpenAI' });

		new Setting(containerEl)
			.setName('API key')
			.setDesc('Temporary dev key; stored in plugin data.')
			.addText(text => text
				.setPlaceholder('sk-... or sk-proj-...')
				.setValue(this.plugin.settings.openAIApiKey || '')
				.onChange(async (value) => {
					this.plugin.settings.openAIApiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Model')
			.setDesc('OpenAI chat model (default: gpt-5)')
			.addText(text => text
				.setPlaceholder('gpt-5')
				.setValue(this.plugin.settings.openAIModel || 'gpt-5')
				.onChange(async (value) => {
					this.plugin.settings.openAIModel = value || 'gpt-5';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Base URL (optional)')
			.setDesc('Override base URL for OpenAI-compatible endpoints')
			.addText(text => text
				.setPlaceholder('https://api.openai.com')
				.setValue(this.plugin.settings.openAIBaseUrl || 'https://api.openai.com')
				.onChange(async (value) => {
					this.plugin.settings.openAIBaseUrl = value || 'https://api.openai.com';
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
			.setName('Auto-open Debug pane')
			.setDesc('Open HUMAIN Debug next to Chat when Chat opens')
			.addToggle(t => t
				.setValue(!!this.plugin.settings.autoOpenDebug)
				.onChange(async (v) => { this.plugin.settings.autoOpenDebug = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName('Auto-open Trace pane')
			.setDesc('Open HUMAIN Trace next to Chat when Chat opens')
			.addToggle(t => t
				.setValue(!!this.plugin.settings.autoOpenTrace)
				.onChange(async (v) => { this.plugin.settings.autoOpenTrace = v; await this.plugin.saveSettings(); }));

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

		new Setting(containerEl)
			.setName('Ocean waves (CSS-only)')
			.setDesc('Gentle layered wave motion on chat background.')
			.addToggle(toggle => toggle
				.setValue(!!this.plugin.settings.oceanEnabled)
				.onChange(async (value) => {
					this.plugin.settings.oceanEnabled = value;
					await this.plugin.saveSettings();
					this.plugin.refreshChatView();
				}));

		new Setting(containerEl)
			.setName('Noise overlay')
			.setDesc('Low-opacity grain for depth without blur.')
			.addToggle(toggle => toggle
				.setValue(!!this.plugin.settings.noiseEnabled)
				.onChange(async (value) => {
					this.plugin.settings.noiseEnabled = value;
					await this.plugin.saveSettings();
					this.plugin.refreshChatView();
				}));

		new Setting(containerEl)
			.setName('Ocean intensity')
			.setDesc('Controls motion/contrast of ocean layers (0.2 – 1).')
			.addSlider(slider => slider
				.setLimits(0.2, 1, 0.05)
				.setValue(this.plugin.settings.oceanIntensity ?? 0.6)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.oceanIntensity = value;
					await this.plugin.saveSettings();
					this.plugin.refreshChatView();
				}));

		containerEl.createEl('h3', { text: 'Agent engine' });

		new Setting(containerEl)
			.setName('Use LangGraph agent')
			.setDesc('Enable the new LangGraph-based agent orchestration (recommended). Turn off to use legacy loop.')
			.addToggle(t => t
				.setValue(!!this.plugin.settings.agenticMode)
				.onChange(async (value) => { this.plugin.settings.agenticMode = value; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName('Final answer streaming')
			.setDesc('Stream tokens for the final response (if supported by model)')
			.addToggle(t => t
				.setValue(!!this.plugin.settings.streamFinalAnswer)
				.onChange(async (value) => { this.plugin.settings.streamFinalAnswer = value; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName('Reasoning effort')
			.setDesc('Hint to thinking models; lower is faster/cheaper.')
			.addDropdown(d => {
				d.addOption('low', 'Low');
				d.addOption('medium', 'Medium');
				d.addOption('high', 'High');
				d.setValue(String(this.plugin.settings.reasoningEffort || 'low'));
				d.onChange(async (value) => { (this.plugin.settings as any).reasoningEffort = (value as any) || 'low'; await this.plugin.saveSettings(); });
				return d;
			});

		new Setting(containerEl)
			.setName('Thinking indicators')
			.setDesc('Show “Planning…”, “Searching…”, “Answering…” states in the chat.')
			.addToggle(t => t
				.setValue(!!this.plugin.settings.thinkingIndicators)
				.onChange(async (value) => { this.plugin.settings.thinkingIndicators = value; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName('Max tool calls')
			.setDesc('Bound the number of agent steps (1–8).')
			.addSlider(s => s
				.setLimits(1, 8, 1)
				.setValue(this.plugin.settings.maxToolCalls ?? 3)
				.setDynamicTooltip()
				.onChange(async (value) => { this.plugin.settings.maxToolCalls = value; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName('Show reasoning')
			.setDesc('Display a collapsible “Thinking…” bubble with agent tool calls and results.')
			.addToggle(t => t
				.setValue(!!this.plugin.settings.showReasoning)
				.onChange(async (value) => { this.plugin.settings.showReasoning = value; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName('Include vault outline each turn')
			.setDesc('Automatically provide a cached high-level vault outline to the agent every turn (uses minimal tokens).')
			.addToggle(t => t
				.setValue(!!this.plugin.settings.includeVaultOutlineEachTurn)
				.onChange(async (value) => { (this.plugin.settings as any).includeVaultOutlineEachTurn = value; await this.plugin.saveSettings(); }));

		// Retrieval & Embeddings
		containerEl.createEl('h3', { text: 'Retrieval & Embeddings' });

		new Setting(containerEl)
			.setName('Ollama host')
			.setDesc('Base URL where Ollama is running')
			.addText(text => text
				.setPlaceholder(DEFAULT_RAG.embeddingHost)
				.setValue(this.plugin.settings.embeddingHost || DEFAULT_RAG.embeddingHost)
				.onChange(async (value) => {
					this.plugin.settings.embeddingHost = value || DEFAULT_RAG.embeddingHost;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Embedding model')
			.setDesc('Ollama embedding model name (e.g., embeddinggemma:300m)')
			.addText(text => text
				.setPlaceholder(DEFAULT_RAG.embeddingModel)
				.setValue(this.plugin.settings.embeddingModel || DEFAULT_RAG.embeddingModel)
				.onChange(async (value) => {
					this.plugin.settings.embeddingModel = value || DEFAULT_RAG.embeddingModel;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('LanceDB directory')
			.setDesc('Relative directory under the vault for the vector index')
			.addText(text => text
				.setPlaceholder(DEFAULT_RAG.lanceDbDir)
				.setValue(this.plugin.settings.lanceDbDir || DEFAULT_RAG.lanceDbDir)
				.onChange(async (value) => {
					this.plugin.settings.lanceDbDir = value || DEFAULT_RAG.lanceDbDir;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Top-K retrieved chunks')
			.setDesc('How many chunks to include in prompts')
			.addSlider(slider => slider
				.setLimits(1, 20, 1)
				.setValue(this.plugin.settings.ragTopK ?? DEFAULT_RAG.ragTopK)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.ragTopK = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Chunk size (chars)')
			.setDesc('Approx tokens*4. Smaller improves precision; larger improves recall.')
			.addText(text => text
				.setPlaceholder(String(DEFAULT_CHUNKING.chunkSizeChars))
				.setValue(String(this.plugin.settings.chunkSizeChars ?? DEFAULT_CHUNKING.chunkSizeChars))
				.onChange(async (value) => {
					const n = parseInt(value, 10);
					this.plugin.settings.chunkSizeChars = Number.isFinite(n) && n > 200 ? n : DEFAULT_CHUNKING.chunkSizeChars;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Chunk overlap (chars)')
			.setDesc('Context overlap between chunks to avoid boundary loss.')
			.addText(text => text
				.setPlaceholder(String(DEFAULT_CHUNKING.chunkOverlapChars))
				.setValue(String(this.plugin.settings.chunkOverlapChars ?? DEFAULT_CHUNKING.chunkOverlapChars))
				.onChange(async (value) => {
					const n = parseInt(value, 10);
					this.plugin.settings.chunkOverlapChars = Number.isFinite(n) && n >= 0 ? n : DEFAULT_CHUNKING.chunkOverlapChars;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Index include folders')
			.setDesc('Comma-separated relative paths to include (empty = all)')
			.addText(text => text
				.setPlaceholder('Notes, Projects/AI')
				.setValue(this.plugin.settings.indexIncludeFolders || '')
				.onChange(async (value) => {
					this.plugin.settings.indexIncludeFolders = value || '';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Index exclude folders')
			.setDesc('Comma-separated relative paths to exclude')
			.addText(text => text
				.setPlaceholder('.obsidian, Templates')
				.setValue(this.plugin.settings.indexExcludeFolders || '')
				.onChange(async (value) => {
					this.plugin.settings.indexExcludeFolders = value || '';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('LLM query rewrite')
			.setDesc('Generate multiple focused search queries from user input')
			.addToggle(t => t
				.setValue(!!this.plugin.settings.retrievalQueryRewrite)
				.onChange(async (value) => {
					this.plugin.settings.retrievalQueryRewrite = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Max generated queries')
			.setDesc('When enabled, generate up to N queries')
			.addSlider(s => s
				.setLimits(1, 5, 1)
				.setValue(this.plugin.settings.retrievalMaxQueries ?? 3)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.retrievalMaxQueries = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Extractors' });

		new Setting(containerEl)
			.setName('Enable PDF extractor')
			.setDesc('Parse text from PDF files for indexing')
			.addToggle(t => t
				.setValue(!!this.plugin.settings.enablePDF)
				.onChange(async (value) => { this.plugin.settings.enablePDF = value; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName('Enable DOCX extractor')
			.setDesc('Parse text from DOCX files for indexing')
			.addToggle(t => t
				.setValue(!!this.plugin.settings.enableDOCX)
				.onChange(async (value) => { this.plugin.settings.enableDOCX = value; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName('Enable PPTX extractor')
			.setDesc('Parse text from PPTX files for indexing')
			.addToggle(t => t
				.setValue(!!this.plugin.settings.enablePPTX)
				.onChange(async (value) => { this.plugin.settings.enablePPTX = value; await this.plugin.saveSettings(); }));
	}
}


