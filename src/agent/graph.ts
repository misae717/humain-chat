import type HumainChatPlugin from '../main';
import { searchSimilar } from '../vector/rag';

// We avoid importing heavy graph constructors at module load to keep Obsidian mobile safe.
// Instead, we dynamic-import inside createAgent to ensure desktop-only deps can be tree-shaken if needed.

export type AgentMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; name?: string };

export interface AgentHandle {
  runTurn(messages: AgentMessage[]): Promise<AgentMessage[]>;
}

export async function createAgent(plugin: HumainChatPlugin): Promise<AgentHandle> {
  // Dynamic import LangGraph/LangChain bits
  const { tool } = await import('@langchain/core/tools');
  const { ChatOpenAI } = await import('@langchain/openai');
  const { StateGraph, START, END } = await import('@langchain/langgraph');
  const { z } = await import('zod');
  const { getVaultOutline } = await import('../vector/tree_outline');

  const settings: any = plugin.settings || {};
  const modelName: string = settings.openAIModel || 'gpt-5';
  const apiKey: string = settings.openAIApiKey || '';
  const baseUrl: string = (settings.openAIBaseUrl || 'https://api.openai.com').replace(/\/$/, '');
  const llm = new ChatOpenAI({
    apiKey,
    model: modelName,
    configuration: { baseURL: `${baseUrl}/v1` }
  } as any);

  // Tools
  const findSimilar = tool(
    async (input: { query: string; k?: number; filter?: { folder?: string } }) => {
      // Disable LLM query rewrite for agent tool path to reduce loops
      const base = String(input.query || '');
      // If filter.folder is "/" or empty, treat as no filter
      const filter = input.filter && typeof input.filter.folder === 'string' && input.filter.folder.trim() && input.filter.folder.trim() !== '/' ? input.filter : undefined;
      const res = await searchSimilar(plugin as any, { mode: 'by_query', query: base, k: Number(input.k || 5), queries: [base], filter });
      return JSON.stringify(res);
    },
    {
      name: 'find_similar',
      description: 'Semantic search in the Obsidian vault.',
      schema: z.object({ query: z.string(), k: z.number().int().min(1).max(5).optional(), filter: z.object({ folder: z.string() }).optional() }) as any,
    }
  );

  const readNote = tool(
    async (input: { note_path: string; max_chars?: number }) => {
      const vault: any = (plugin.app as any).vault;
      const file: any = vault.getAbstractFileByPath(String(input.note_path || ''));
      if (!file) return JSON.stringify({ path: input.note_path, text: '' });
      let text = '';
      if (String(file.extension || '').toLowerCase() === 'md') {
        text = await vault.read(file);
      } else {
        const { extractIfSupported } = await import('../vector/extractors');
        const ex = await extractIfSupported(plugin as any, file);
        text = ex?.text || '';
      }
      const max = Math.max(0, Math.min(20000, Number(input?.max_chars || 4000)));
      if (max && text.length > max) text = text.slice(0, max);
      return JSON.stringify({ path: input.note_path, text });
    },
    {
      name: 'read_note',
      description: 'Read a note or file text.',
      schema: z.object({ note_path: z.string(), max_chars: z.number().int().min(100).max(20000).optional() }) as any,
    }
  );

  const vaultOutline = tool(
    async (input: { maxFolders?: number; maxChars?: number }) => {
      const text = getVaultOutline(plugin as any, { maxFolders: input?.maxFolders, maxChars: input?.maxChars });
      return JSON.stringify({ outline: text });
    },
    {
      name: 'vault_outline',
      description: 'Return a high-level outline of the vault folder tree with counts.',
      schema: z.object({ maxFolders: z.number().int().min(1).max(200).optional(), maxChars: z.number().int().min(500).max(20000).optional() }) as any,
    }
  );

  // Minimal graph: single LLM node with tool calling enabled
  const graph = new StateGraph({ channels: { messages: {} } })
    .addNode('llm', async (state: any) => state)
    .addEdge(START, 'llm')
    .addEdge('llm', END)
    .compile();

  return {
    async runTurn(messages: AgentMessage[]): Promise<AgentMessage[]> {
      // Simple tool-execution loop around the LLM
      const tools = [findSimilar, readNote, vaultOutline] as any[];
      const byName: Record<string, any> = Object.fromEntries(tools.map(t => [t.name, t]));

      const maxSteps = 6;
      let history: any[] = [...messages];
      let consecutiveEmptySearches = 0;
      let findSimilarCount = 0;
      const seenCalls = new Map<string, number>();
      const trace: any[] = [];
      const push = (title: string, data: any) => trace.push({ title, data });
      for (let step = 0; step < maxSteps; step++) {
        const res: any = await llm.bindTools(tools as any).invoke(history as any);
        const toolCalls: any[] = res?.tool_calls || res?.additional_kwargs?.tool_calls || [];
        history.push(res);
        push(`Model step ${step+1}`, { request: history.slice(-4), response: res });
        if (!toolCalls.length) {
          // Final assistant message
          try { (await import('../ui/traceView')).setLastTrace(trace); } catch {}
          return history as any;
        }
        // Execute tools and append Tool messages
        for (const tc of toolCalls) {
          const name = String(tc?.name || '');
          const tool = byName[name];
          if (!tool) continue;
          let args: any = tc?.args;
          if (typeof args === 'string') { try { args = JSON.parse(args); } catch {} }
          const sig = `${name}:${JSON.stringify(args || {})}`;
          const prevCount = seenCalls.get(sig) || 0;
          if (prevCount >= 1) {
            push(`Tool ${name} skipped (duplicate)`, { args });
            continue;
          }
          try {
            const result = await tool.invoke(args);
            push(`Tool ${name}`, { args, result: safeJson(result) });
            history.push({ role: 'tool', content: result, name, tool_call_id: tc?.id } as any);
            // Detect empty retrieval results to avoid loops
            if (name === 'find_similar') {
              findSimilarCount++;
              try {
                const data = JSON.parse(String(result || 'null'));
                if (!Array.isArray(data) || data.length === 0) consecutiveEmptySearches++;
                else consecutiveEmptySearches = 0;
              } catch { consecutiveEmptySearches++; }
            }
            seenCalls.set(sig, prevCount + 1);
          } catch (e: any) {
            push(`Tool ${name} error`, { args, error: e?.message || String(e) });
            history.push({ role: 'tool', content: JSON.stringify({ ok: false, error: e?.message || String(e) }), name, tool_call_id: tc?.id } as any);
          }
        }
        if (findSimilarCount >= 3) {
          history.push({ role: 'system', content: 'Search attempted 3 times. Provide your best answer without more tool calls.' } as any);
          const final: any = await llm.invoke(history as any);
          history.push(final);
          try { (await import('../ui/traceView')).setLastTrace(trace); } catch {}
          return history as any;
        }
        if (consecutiveEmptySearches >= 2) {
          history.push({ role: 'system', content: 'Search returned no useful results twice. Provide your best answer without more tool calls.' } as any);
          const final: any = await llm.invoke(history as any);
          history.push(final);
          try { (await import('../ui/traceView')).setLastTrace(trace); } catch {}
          return history as any;
        }
      }
      // Fallback if loop exhausted
      try { (await import('../ui/traceView')).setLastTrace(trace); } catch {}
      return history as any;
    }
  };
}

function safeJson(x: any) {
  try { return JSON.parse(JSON.stringify(x)); } catch { return String(x); }
}


