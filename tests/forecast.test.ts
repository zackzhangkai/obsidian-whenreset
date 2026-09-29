import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecast } from '../src/model.ts';
import type { RadarEvent } from '../src/types.ts';

const ev = (over: Partial<RadarEvent> = {}): RadarEvent => ({
  id: 'e1', type: 'reset', status: 'candidate', title: 't', summary: null,
  audience: null, text: 'text', translation: null, resetAt: null, suggestedResetAt: null,
  sourceUrl: 'https://x.com/thsottiaux/status/1', publishedAt: '2026-09-01T00:00:00.000Z',
  detectedAt: '2026-09-01T00:00:00.000Z', reviewedAt: null, ...over,
});
const completed = (i: number, at: string): RadarEvent => ev({ id: 'c' + i, status: 'completed', publishedAt: at, occurrenceId: 'occ' + i });

test('announced mode when a scheduled reset lies in the future', () => {
  const now = Date.parse('2026-09-29T00:00:00.000Z');
  const f = forecast([ev({ id: 's1', status: 'scheduled', resetAt: '2026-10-01T00:00:00.000Z', publishedAt: '2026-09-28T00:00:00.000Z' })], now);
  assert.equal(f.mode, 'announced');
  assert.equal(f.candidates[0].at, '2026-10-01T00:00:00.000Z');
  assert.equal(f.candidates[0].kind, 'announced');
});

test('signal mode from weekday hint with cutoff candidate', () => {
  const now = Date.parse('2026-09-29T12:00:00.000Z'); // 洛杉矶 2026-09-29 周二 05:00
  const f = forecast([ev({ id: 'g1', text: 'More resets coming Thursday', publishedAt: '2026-09-29T06:00:00.000Z' })], now);
  assert.equal(f.mode, 'signal');
  const cutoff = f.candidates.at(-1);
  assert.ok(cutoff);
  assert.equal(cutoff.kind, 'cutoff');
  assert.equal(cutoff.at, '2026-10-02T07:00:00.000Z'); // 周五 00:00 洛杉矶(PDT, UTC-7)
});

test('history mode from quantile gaps with 6 completed resets', () => {
  const days = ['2026-05-01', '2026-05-11', '2026-05-21', '2026-05-31', '2026-06-10', '2026-06-20'];
  const events = days.map((d, i) => completed(i, d + 'T00:00:00.000Z'));
  const now = Date.parse('2026-06-21T00:00:00.000Z'); // 距上次 1 天,间隔全部 10 天
  const f = forecast(events, now);
  assert.equal(f.mode, 'history');
  assert.ok(f.candidates.length >= 1);
  assert.equal(f.candidates[0].kind, 'interval');
  assert.equal(f.candidates[0].at, '2026-06-30T00:00:00.000Z'); // 最后一次 +10 天
});

test('insufficient mode with no usable signals', () => {
  const f = forecast([], Date.parse('2026-09-29T00:00:00.000Z'));
  assert.equal(f.mode, 'insufficient');
  assert.equal(f.candidates.length, 0);
});
