export interface HumainChatSettings {
	enabled: boolean;
	autoOpenOnStart: boolean;
	autoOpenDebug?: boolean;
	autoOpenTrace?: boolean;
	compactUI: boolean;
	accentColor: string;
	gradientEnabled: boolean;
	gradientStart: string;
	gradientEnd: string;
	gradientAngle: string;
	glassBlur: string;
	glassOpacity: string;
	animatedGradient: boolean;
	oceanEnabled?: boolean;
	noiseEnabled?: boolean;
	oceanIntensity?: number; // 0.0 - 1.0
	openAIApiKey?: string;
	openAIModel?: string;
	openAIBaseUrl?: string;
	// Reasoning & Agentic behavior
	agenticMode?: boolean;
	streamFinalAnswer?: boolean;
	reasoningEffort?: 'low' | 'medium' | 'high';
	thinkingIndicators?: boolean;
	maxToolCalls?: number;
	showReasoning?: boolean;
	includeVaultOutlineEachTurn?: boolean;
	// RAG / Embeddings
	embeddingModel?: string; // Ollama model name
	embeddingHost?: string; // Ollama host, e.g. http://127.0.0.1:11434
	lanceDbDir?: string; // Directory for LanceDB inside the vault
	ragTopK?: number; // Retrieval top-K
	mmrLambda?: number; // 0-1 tradeoff for diversity
	minChunkChars?: number; // penalize very short chunks
	indexIncludeFolders?: string; // comma-separated relative paths
	indexExcludeFolders?: string; // comma-separated relative paths
	chunkSizeChars?: number; // approx tokens * 4
	chunkOverlapChars?: number; // overlap in characters
	retrievalQueryRewrite?: boolean; // LLM-assisted query expansion
	retrievalMaxQueries?: number; // max queries to generate
	// Extractors
	enablePDF?: boolean;
	enableDOCX?: boolean;
	enablePPTX?: boolean;
}

export const DEFAULT_SETTINGS: HumainChatSettings = {
	enabled: true,
	autoOpenOnStart: true,
	autoOpenDebug: true,
	autoOpenTrace: true,
	compactUI: false,
	accentColor: '#00D49C',
	gradientEnabled: true,
	gradientStart: '#a8f374',
	gradientEnd: '#00bfa5',
	gradientAngle: '180deg',
	glassBlur: '10px',
	glassOpacity: '0.65'
,
	animatedGradient: true
,
	oceanEnabled: true,
	noiseEnabled: true,
	oceanIntensity: 0.6
,
	openAIApiKey: '',
	openAIModel: 'gpt-5',
	openAIBaseUrl: 'https://api.openai.com'
,
	// Reasoning & Agent defaults
	agenticMode: true,
	streamFinalAnswer: false,
	reasoningEffort: 'low',
	thinkingIndicators: true,
	maxToolCalls: 3,
	showReasoning: true
};

// Defaults for RAG (applied at runtime if missing to avoid migrations)
export const DEFAULT_RAG: Required<Pick<HumainChatSettings, 'embeddingModel' | 'embeddingHost' | 'lanceDbDir' | 'ragTopK'>> = {
	embeddingModel: 'embeddinggemma:300m',
	embeddingHost: 'http://127.0.0.1:11434',
	lanceDbDir: '.humain-index',
	ragTopK: 20,
};

export const DEFAULT_CHUNKING = {
	chunkSizeChars: 2800, // ~700 tokens (keeps margin under 768)
	chunkOverlapChars: 400, // ~100 tokens
};

export const VIEW_TYPE_CHAT = 'humain-chat-view';
export const VIEW_TYPE_DEBUG = 'humain-debug-view';
export const VIEW_TYPE_TRACE = 'humain-trace-view';


