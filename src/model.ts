import type { RadarData, RadarEvent } from './types.ts';

export const statuses: Record<string, { label: string; tone: string }> = {
  candidate: { label: '待核实信号', tone: 'amber' },
  scheduled: { label: '已核实预告', tone: 'green' },
  completed: { label: '已确认发生', tone: 'green' },
  dismissed: { label: '已排除', tone: 'muted' },
};

export interface Remaining { days: number; hours: number; minutes: number; seconds: number; expired: boolean; }

export function remaining(target: string, now: number = Date.now()): Remaining | null {
  const timestamp = Date.parse(target);
  if (!Number.isFinite(timestamp)) return null;
  const seconds = Math.max(0, Math.ceil((timestamp - now) / 1000));
  return { days: Math.floor(seconds / 86400), hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60, expired: timestamp <= now };
}

export function activeEvent(events: RadarEvent[]): RadarEvent | null {
  const visible = events.filter(e => e.status !== 'dismissed');
  const confirmed = visible.filter(e => (e.status === 'scheduled' && e.resetAt) || e.status === 'completed')
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  if (confirmed[0]?.status === 'scheduled') return confirmed[0];
  return visible.slice().sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0] || null;
}

export function safeSource(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && ['x.com', 'twitter.com'].includes(u.hostname) && /^\/\w+\/status\/\d+$/.test(u.pathname) ? u.href : null;
  } catch { return null; }
}

export function validateRadar(data: unknown): RadarData {
  const d = data as RadarData | null | undefined;
  if (!d || d.version !== 1 || d.account?.username !== 'thsottiaux' || !Array.isArray(d.events) || d.events.length > 1000 || !d.sync) throw new Error('事件数据格式不正确');
  if (!['unconfigured', 'ok', 'error'].includes(d.sync.status)) throw new Error('同步状态不正确');
  for (const event of d.events) {
    if (typeof event.id !== 'string' || !/^[\w-]{1,80}$/.test(event.id) || !statuses[event.status] || typeof event.text !== 'string' || event.text.length > 50000 || typeof event.title !== 'string' || !Number.isFinite(Date.parse(event.publishedAt))) throw new Error('事件字段不正确');
    if (event.resetAt && !Number.isFinite(Date.parse(event.resetAt))) throw new Error('事件时间不正确');
    if (event.status === 'scheduled' && !event.resetAt) throw new Error('预告缺少明确时间');
  }
  return d;
}

export interface RadarState { radar: RadarData | null; checkedAt: number | null; lastSuccessAt: number | null; error: string | null; }

export function buildFetchUrl(url: string, nonce: number): string {
  const u = new URL(url);
  u.searchParams.set('refresh', String(nonce));
  return u.toString();
}

export function nextRadarState(prev: RadarState, radar: RadarData | null, now: number): RadarState {
  return radar
    ? { radar, checkedAt: now, lastSuccessAt: now, error: null }
    : { radar: prev.radar, checkedAt: now, lastSuccessAt: prev.lastSuccessAt, error: '更新失败，正在显示上次数据。' };
}

export const SOURCE_ZONE = 'America/Los_Angeles';
const DAY = 86400000;

export function zonedParts(time: number | string, zone: string = SOURCE_ZONE): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(new Date(time)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}

export function localTime(y: number, m: number, d: number, h = 0, minute = 0, zone = SOURCE_ZONE): number {
  const desired = Date.UTC(y, m - 1, d, h, minute); let value = desired;
  for (let i = 0; i < 3; i++) { const p = zonedParts(value, zone); value += desired - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute); }
  return value;
}

function historicalResets(events: RadarEvent[]): RadarEvent[] {
  const unique = new Map<string, RadarEvent>();
  events.filter(e => e.status === 'completed' && e.type === 'reset').sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt)).forEach(e => { unique.set(e.occurrenceId || e.id, e); });
  return [...unique.values()];
}

function statistics(events: RadarEvent[]) {
  const records = historicalResets(events), times = records.map(e => Date.parse(e.publishedAt));
  const gaps = times.slice(1).map((t, i) => (t - times[i]) / DAY).filter(g => g > 0);
  return { records, gaps, count: records.length, cards: events.filter(e => e.status === 'completed' && e.type === 'card').length, average: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null, longest: gaps.length ? Math.max(...gaps) : null };
}

function latestActivity(events: RadarEvent[], now: number): RadarEvent | null {
  return events.filter(e => e.status === 'completed' && ['reset', 'card'].includes(e.type) && Date.parse(e.publishedAt) <= now)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0] || null;
}

function activityStatistics(events: RadarEvent[], now: number) {
  const unique = new Map<string, RadarEvent>();
  events.filter(e => e.status === 'completed' && ['reset', 'card'].includes(e.type) && Date.parse(e.publishedAt) <= now)
    .sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt))
    .forEach(e => unique.set(e.occurrenceId || e.id, e));
  const records = [...unique.values()].sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
  const gaps = records.slice(1).map((e, i) => (Date.parse(e.publishedAt) - Date.parse(records[i].publishedAt)) / DAY).filter(g => g > 0);
  return { records, gaps, count: records.length };
}

export interface ForecastCandidate { at: string; kind: 'announced' | 'weekday' | 'cutoff' | 'interval'; evidence: string[]; }
export interface ForecastResult {
  mode: 'announced' | 'signal' | 'history' | 'insufficient';
  candidates: ForecastCandidate[];
  stats: ReturnType<typeof statistics>;
  last: RadarEvent | null;
  activity: RadarEvent | null;
  basis: ReturnType<typeof activityStatistics>;
  signal: RadarEvent | null;
  start?: string; end?: string;
}

export function forecast(events: RadarEvent[], now: number = Date.now()): ForecastResult {
  const stats = statistics(events), last = stats.records.at(-1) || null, activity = latestActivity(events, now);
  const basis = activityStatistics(events, now);
  const upcoming = events.filter(e => e.status === 'scheduled' && Date.parse(e.resetAt ?? '') > now).sort((a, b) => Date.parse(a.resetAt ?? '') - Date.parse(b.resetAt ?? ''))[0];
  if (upcoming) return { mode: 'announced', signal: upcoming, candidates: [{ at: upcoming.resetAt as string, kind: 'announced', evidence: [upcoming.id] }], stats, last, activity, basis };
  const signals = events.filter(e => e.status !== 'dismissed' && e.status !== 'completed' && Date.parse(e.publishedAt) <= now && now - Date.parse(e.publishedAt) < 7 * DAY && (!activity || Date.parse(e.publishedAt) > Date.parse(activity.publishedAt))).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  for (const signal of signals) {
    if (!/(?:coming|land|ship|drop|release|reset)/i.test(signal.text)) continue;
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const match = signal.text.match(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/i);
    if (!match) continue;
    const p = zonedParts(signal.publishedAt); const base = new Date(Date.UTC(+p.year, +p.month - 1, +p.day)); const weekday = names.findIndex(n => n.toLowerCase() === match[1].toLowerCase());
    const delta = (weekday - base.getUTCDay() + 7) % 7; base.setUTCDate(base.getUTCDate() + delta);
    const y = base.getUTCFullYear(), m = base.getUTCMonth() + 1, d = base.getUTCDate();
    const start = localTime(y, m, d), end = localTime(y, m, d + 1);
    if (end <= now) continue;
    const historical = stats.records.filter(e => names[weekday].startsWith(zonedParts(e.publishedAt).weekday));
    const slots = new Map<number, ForecastCandidate>();
    for (const e of historical) { const q = zonedParts(e.publishedAt); const at = localTime(y, m, d, +q.hour, +q.minute); if (at > now) slots.set(at, { at: new Date(at).toISOString(), kind: 'weekday', evidence: [e.id] }); }
    const candidates = [...slots.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(0, 2);
    candidates.push({ at: new Date(end).toISOString(), kind: 'cutoff', evidence: [signal.id] });
    return { mode: 'signal', signal, start: new Date(start).toISOString(), end: new Date(end).toISOString(), candidates, stats, last, activity, basis };
  }
  const candidates: ForecastCandidate[] = [];
  if (activity && basis.gaps.length >= 5) {
    const elapsed = (now - Date.parse(activity.publishedAt)) / DAY;
    const remainingGaps = basis.gaps.filter(g => g > elapsed).sort((a, b) => a - b);
    for (const quantile of [.25, .5, .75]) { if (!remainingGaps.length) break; const gap = remainingGaps[Math.floor((remainingGaps.length - 1) * quantile)]; const at = new Date(Date.parse(activity.publishedAt) + gap * DAY).toISOString(); if (!candidates.some(c => c.at === at)) candidates.push({ at, kind: 'interval', evidence: basis.records.map(e => e.id) }); }
  }
  return { mode: candidates.length ? 'history' : 'insufficient', signal: signals[0] || null, candidates, stats, last, activity, basis };
}
