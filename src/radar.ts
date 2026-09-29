import { requestUrl } from 'obsidian';
import { buildFetchUrl, nextRadarState, validateRadar } from './model.ts';
import type { RadarState } from './model.ts';

type Listener = (state: RadarState) => void;

export class RadarStore {
  private state: RadarState = { radar: null, checkedAt: null, lastSuccessAt: null, error: null };
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
        const res = await requestUrl({ url: buildFetchUrl(this.url, Date.now()), method: 'GET', throw: false });
        const radar = res.status === 200 ? validateRadar(res.json) : null;
        this.state = nextRadarState(this.state, radar, Date.now());
      } catch {
        this.state = nextRadarState(this.state, null, Date.now());
      }
      for (const fn of this.listeners) fn(this.state);
    })().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }
}
