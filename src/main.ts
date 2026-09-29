import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { RadarStore } from './radar.ts';
import { forecast, remaining } from './model.ts';
import { announceMessage, freshAnnounced, isAnnounced, mergeSeen, seenKey } from './notify.ts';
import { DEFAULT_SETTINGS } from './types.ts';
import type { WhenresetSettings } from './types.ts';
import { RadarView, VIEW_TYPE_WHENRESET } from './view.ts';
import { WhenresetSettingTab } from './settings.ts';

interface ExtraData { seen: string[]; installedAt: number; }
const DEFAULT_EXTRA: ExtraData = { seen: [], installedAt: 0 };
const pad = (n: number) => String(n).padStart(2, '0');

export default class WhenresetPlugin extends Plugin {
  settings: WhenresetSettings = DEFAULT_SETTINGS;
  private extra: ExtraData = DEFAULT_EXTRA;
  store: RadarStore = new RadarStore(DEFAULT_SETTINGS.dataUrl);
  private refreshHandle: number | null = null;
  private statusEl: HTMLElement | null = null;

  async onload(): Promise<void> {
    const loaded = await this.loadData() as Partial<{ settings: WhenresetSettings; seen: string[]; installedAt: number }> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(loaded?.settings ?? {}) };
    this.extra = { seen: loaded?.seen ?? [], installedAt: loaded?.installedAt ?? 0 };
    if (!this.extra.installedAt) { this.extra.installedAt = Date.now(); await this.savePluginData(); }

    this.store = new RadarStore(this.settings.dataUrl);
    this.registerView(VIEW_TYPE_WHENRESET, (leaf: WorkspaceLeaf) => new RadarView(leaf, this));
    this.addRibbonIcon('radar', '重置雷达', () => { void this.activateView(); });
    this.addCommand({ id: 'open', name: '打开重置雷达视图', callback: () => { void this.activateView(); } });
    this.addCommand({ id: 'refresh', name: '立即刷新雷达数据', callback: () => { void this.refreshNow(); } });
    this.addSettingTab(new WhenresetSettingTab(this.app, this));

    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass('whenreset-status');
    this.statusEl.addEventListener('click', () => { void this.activateView(); });
    this.statusEl.setText('⏳ 重置雷达加载中…');

    this.store.subscribe(() => this.renderStatus());
    this.registerInterval(window.setInterval(() => this.renderStatus(), 1000));
    this.applySchedule(true);
  }

  onunload(): void {
    if (this.refreshHandle !== null) window.clearInterval(this.refreshHandle);
  }

  async savePluginData(): Promise<void> {
    await this.saveData({ settings: this.settings, seen: this.extra.seen, installedAt: this.extra.installedAt });
  }

  applySchedule(initial: boolean): void {
    if (this.refreshHandle !== null) window.clearInterval(this.refreshHandle);
    const minutes = Math.max(5, Math.min(60, this.settings.refreshMinutes));
    this.refreshHandle = window.setInterval(() => { void this.refreshNow(false); }, minutes * 60000);
    if (initial) void this.refreshNow(false);
  }

  async refreshNow(notice = true): Promise<void> {
    await this.store.refresh();
    const { radar, error } = this.store.getState();
    if (!radar) { if (notice) new Notice(error ?? '雷达数据不可用'); return; }
    const fresh = freshAnnounced(radar.events, this.extra.seen, this.extra.installedAt);
    this.extra.seen = mergeSeen(this.extra.seen, radar.events.filter(isAnnounced).map(seenKey));
    await this.savePluginData();
    if (this.settings.notify) {
      for (const e of fresh.slice(0, 3)) { const m = announceMessage(e); new Notice(`${m.title}\n${m.body}`, 8000); }
    }
    if (notice) new Notice('重置雷达数据已刷新');
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_WHENRESET);
    if (existing.length > 0) leaf = existing[0];
    else {
      leaf = workspace.getRightLeaf(false);
      await leaf?.setViewState({ type: VIEW_TYPE_WHENRESET, active: true });
    }
    if (leaf) await workspace.revealLeaf(leaf); // @since 1.7.2,与 manifest minAppVersion 对齐
  }

  private renderStatus(): void {
    if (!this.statusEl) return;
    const { radar, error } = this.store.getState();
    if (!radar) {
      this.statusEl.setText(error ? '⚠ 重置雷达数据异常' : '⏳ 重置雷达加载中…');
      return;
    }
    const f = forecast(radar.events);
    const c = f.candidates[0];
    const r = c ? remaining(c.at) : null;
    const degraded = Boolean(error) || radar.sync.status !== 'ok';
    let text: string;
    if (r && !r.expired) {
      const head = f.mode === 'announced' ? '已公告重置' : '预计重置';
      text = `⏳ ${r.days}天 ${pad(r.hours)}:${pad(r.minutes)}:${pad(r.seconds)} · ${head}`;
    } else if (r?.expired) {
      text = '⏳ 时间已到 · 等待核验'; // 到零不宣称已重置
    } else {
      text = f.activity ? '⏳ 等待新信号' : '⏳ 暂无可靠时间';
    }
    this.statusEl.setText(degraded ? `⚠ ${text}` : text);
  }
}
