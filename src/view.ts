import { ItemView, Setting, WorkspaceLeaf } from 'obsidian';
import { forecast, remaining, safeSource } from './model.ts';
import type { RadarEvent } from './types.ts';
import type WhenresetPlugin from './main.ts';

export const VIEW_TYPE_WHENRESET = 'whenreset-radar-view';

const pad = (n: number) => String(n).padStart(2, '0');
const dateFmt = (s: string) => new Date(s).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const tagLabel = (e: RadarEvent) => e.status === 'completed' ? (e.type === 'card' ? '已宣布发卡' : '已宣布重置') : e.status === 'scheduled' ? '已核实预告' : '待核实信号';

export class RadarView extends ItemView {
  private plugin: WhenresetPlugin;
  private unsubscribe: (() => void) | null = null;
  private tick: number | null = null;
  private clockEl: HTMLElement | null = null;
  private targetEl: HTMLElement | null = null;
  private kindEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: WhenresetPlugin) { super(leaf); this.plugin = plugin; }

  getViewType(): string { return VIEW_TYPE_WHENRESET; }
  getDisplayText(): string { return '重置雷达'; }
  getIcon(): string { return 'radar'; }

  async onOpen(): Promise<void> {
    this.unsubscribe = this.plugin.store.subscribe(() => this.render());
    this.tick = window.setInterval(() => this.renderClock(), 1000);
    this.render();
    void this.plugin.refreshNow(false);
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    if (this.tick !== null) window.clearInterval(this.tick);
  }

  private render(): void {
    const { radar, error, checkedAt } = this.plugin.store.getState();
    const root = this.contentEl;
    root.empty();
    root.addClass('whenreset-view');

    const head = root.createDiv({ cls: 'whenreset-status-line' });
    const updated = checkedAt ? dateFmt(new Date(checkedAt).toISOString()) : '';
    head.setText(error
      ? `${error}${updated ? ' 上次成功更新：' + updated : ''}`
      : radar && radar.sync.status !== 'ok' ? '网站采集异常，数据可能过时。'
      : updated ? `数据更新：${updated}` : '正在获取数据…');

    this.kindEl = root.createDiv({ cls: 'whenreset-kind' });
    const clockWrap = root.createDiv({ cls: 'whenreset-clock' });
    this.clockEl = clockWrap.createDiv({ cls: 'whenreset-clock-time' });
    this.targetEl = root.createDiv({ cls: 'whenreset-target' });

    const refreshRow = root.createDiv({ cls: 'whenreset-actions' });
    new Setting(refreshRow).addButton(btn => btn
      .setButtonText('立即刷新')
      .onClick(() => void this.plugin.refreshNow()));

    if (!radar) { this.clockEl.setText('暂未获取数据'); return; }
    this.renderClock();
    this.renderFeed(root, radar.events);
  }

  private renderClock(): void {
    if (!this.clockEl || !this.targetEl || !this.kindEl) return;
    const { radar } = this.plugin.store.getState();
    if (!radar) return;
    const f = forecast(radar.events);
    const c = f.candidates[0];
    const activity = f.activity;
    this.kindEl.setText(f.mode === 'announced' ? '已公告的重置时间' : c ? '预计下次重置' : '等待新信号');
    const r = c ? remaining(c.at) : null;
    this.clockEl.setText(r && !r.expired
      ? `${r.days}天 ${pad(r.hours)}:${pad(r.minutes)}:${pad(r.seconds)}`
      : r?.expired ? '时间已到 · 等待核验' : '暂无可靠时间');
    this.targetEl.setText(c
      ? `${dateFmt(c.at)} · 本机时区${c.kind === 'cutoff' ? ' · 信号观察截止' : ''}`
      : activity?.type === 'card' ? '已宣布发放重置卡，等待下一次新信号' : '暂不生成倒计时');
    if (activity) {
      this.targetEl.createDiv({ cls: 'whenreset-activity' })
        .setText(`最近额度动态:${dateFmt(activity.publishedAt)} · ${activity.type === 'card' ? '重置卡' : '额度重置'}`);
    }
  }

  private renderFeed(root: HTMLElement, events: RadarEvent[]): void {
    const list = root.createDiv({ cls: 'whenreset-feed' });
    const visible = events.filter(e => e.status !== 'dismissed')
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
      .slice(0, 8);
    for (const e of visible) {
      const item = list.createEl('article', { cls: 'whenreset-item' });
      item.createEl('span', { cls: 'whenreset-tag whenreset-tag-' + e.status, text: tagLabel(e) });
      item.createEl('time', { text: dateFmt(e.publishedAt) });
      item.createEl('p', { text: e.summary || e.title });
      const source = safeSource(e.sourceUrl);
      if (source) {
        const a = item.createEl('a', { text: '查看原帖 ↗' });
        a.href = source; a.target = '_blank'; a.rel = 'noopener';
      }
    }
  }
}
