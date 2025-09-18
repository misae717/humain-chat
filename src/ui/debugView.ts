import { ItemView, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_DEBUG } from '../types';

export class DebugView extends ItemView {
  private logs: string[] = [];

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
    const body = root.createEl('pre', { cls: 'humain-debug-body', attr: { contenteditable: 'true' } });

    const render = () => { body.setText(this.logs.join('\n\n')); body.scrollTop = body.scrollHeight; };
    // Save renderer to global for logging
    (window as any).__HUMAIN_DEBUG_APPEND__ = (entry: string) => { this.logs.push(entry); render(); };
    render();
  }

  async onClose(): Promise<void> { this.contentEl.empty(); }
}

export function appendDebug(entry: string) {
  try { (window as any).__HUMAIN_DEBUG_APPEND__?.(entry); } catch (_) {}
}



