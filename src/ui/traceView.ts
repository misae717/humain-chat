import { ItemView, WorkspaceLeaf, MarkdownRenderer } from 'obsidian';
import { VIEW_TYPE_TRACE } from '../types';

export class TraceView extends ItemView {
  constructor(leaf: WorkspaceLeaf) { super(leaf); }
  getViewType(): string { return VIEW_TYPE_TRACE; }
  getDisplayText(): string { return 'HUMAIN Trace'; }
  getIcon(): string { return 'list-ordered'; }

  async onOpen() {
    const root = this.contentEl;
    root.addClass('humain-trace-view');
    const header = root.createEl('div', { cls: 'humain-trace-header', text: 'Agent Trace' });
    const body = root.createEl('div', { cls: 'humain-trace-body' });
    ;(body.style as any)['-webkit-user-select'] = 'text';
    body.style.userSelect = 'text';

    const trace: any[] = (window as any).__HUMAIN_LAST_TRACE__ || [];
    if (!Array.isArray(trace) || trace.length === 0) {
      body.setText('No trace available yet. Send a message in chat to generate a trace.');
      return;
    }
    for (const step of trace) {
      const card = body.createEl('div', { cls: 'humain-trace-card' });
      card.createEl('div', { cls: 'humain-trace-title', text: step.title || 'Step' });
      const pre = card.createEl('pre', { cls: 'humain-trace-pre' });
      pre.setText(JSON.stringify(step.data, null, 2));
    }
  }

  async onClose() { this.contentEl.empty(); }
}

export function setLastTrace(trace: any[]) {
  (window as any).__HUMAIN_LAST_TRACE__ = trace;
}


