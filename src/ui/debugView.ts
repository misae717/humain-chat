import { ItemView, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_DEBUG } from '../types';

export class DebugView extends ItemView {
  private logs: Array<{ t: string; m: string; ctx?: any }> = [];

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE_DEBUG; }
  getDisplayText(): string { return 'HUMAIN Debug'; }
  getIcon(): string { return 'bug'; }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    root.addClass('humain-debug-view');
    const header = root.createEl('div', { cls: 'humain-debug-header', text: 'HUMAIN Debug' });
    const actions = root.createEl('div', { cls: 'humain-debug-actions' });
    const clearBtn = actions.createEl('button', { text: 'Clear' });
    clearBtn.onclick = () => { this.logs = []; render(); };
    const body = root.createEl('pre', { cls: 'humain-debug-body' });
    body.style.userSelect = 'text';
    (body.style as any)['-webkit-user-select'] = 'text';

    const render = () => {
      const lines: string[] = [];
      for (const e of this.logs.slice(-400)) {
        const ctx = e.ctx ? `\n${JSON.stringify(e.ctx, null, 2)}` : '';
        lines.push(`[${e.t}] ${e.m}${ctx}`);
      }
      body.setText(lines.join('\n\n'));
      body.scrollTop = body.scrollHeight;
    };
    // Save renderer to global for logging (structured)
    (window as any).__HUMAIN_DEBUG_APPEND__ = (type: string, message: string, ctx?: any) => {
      this.logs.push({ t: type, m: message, ctx });
      render();
    };
    render();
  }

  async onClose(): Promise<void> { this.contentEl.empty(); }
}

export function appendDebug(entry: string) {
  try { (window as any).__HUMAIN_DEBUG_APPEND__?.('log', entry); } catch (_) {}
}

export function debugEvent(type: 'agent' | 'retrieval' | 'error' | 'openai' | 'log', message: string, ctx?: any) {
  try { (window as any).__HUMAIN_DEBUG_APPEND__?.(type, message, ctx); } catch (_) {}
}



