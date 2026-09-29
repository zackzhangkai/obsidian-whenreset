import type { RadarEvent } from './types.ts';

const DAY_MS = 86400000;

export function isAnnounced(e: RadarEvent): boolean {
  return (e.status === 'completed' && (e.type === 'reset' || e.type === 'card')) || e.status === 'scheduled';
}

export function seenKey(e: RadarEvent): string {
  return `${e.status}:${e.id}`;
}

export function freshAnnounced(events: RadarEvent[], seen: string[], sinceMs: number, now: number = Date.now()): RadarEvent[] {
  return events
    .filter(isAnnounced)
    .filter(e => !seen.includes(seenKey(e)))
    .filter(e => {
      const at = Date.parse(e.publishedAt);
      return Number.isFinite(at) && at >= sinceMs && at <= now && now - at < DAY_MS;
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export function mergeSeen(seen: string[], keys: string[], cap = 1000): string[] {
  return [...new Set([...seen, ...keys])].slice(-cap);
}

export function announceMessage(e: RadarEvent): { title: string; body: string } {
  const title = e.status === 'scheduled' ? 'Codex 有新的重置预告' : e.type === 'card' ? 'Codex 有新的发卡公告' : 'Codex 有新的重置公告';
  return { title, body: (e.summary || e.title).slice(0, 180) };
}
