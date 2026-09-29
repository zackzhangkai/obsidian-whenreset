import { requestUrl } from 'obsidian';
import { validateRadar } from './model.ts';
import type { RadarData } from './types.ts';

export interface RadarState { radar: RadarData | null; checkedAt: number | null; error: string | null; }
type Listener = (state: RadarState) => void;

export class RadarStore {
  private state: RadarState = { radar: null, checkedAt: null, error: null };
  private listeners = new Set<Listener>();
  private inFlight: Promise<void> | null = null;
  private url: string;

  constructor(url: string) { this.url = url; }

  setUrl(url: string): void { this.url = url; }

  getState(): RadarState { return this.state; }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  refresh(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = (async () => {
      try {
        const res = await requestUrl({ url: `${this.url}?refresh=${Date.now()}`, method: 'GET', throw: false });
        if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
        const radar = validateRadar(res.json);
        this.state = { radar, checkedAt: Date.now(), error: null };
      } catch {
        this.state = { ...this.state, checkedAt: Date.now(), error: '更新失败，正在显示上次数据。' };
      }
      for (const fn of this.listeners) fn(this.state);
    })().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }
}
