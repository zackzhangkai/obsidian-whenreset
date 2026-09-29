import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remaining, safeSource, validateRadar } from '../src/model.ts';

const baseEvent = (over = {}) => ({
  id: 'e1', type: 'reset', status: 'candidate', title: '标题', summary: '摘要',
  audience: null, text: 'text', translation: null, resetAt: null, suggestedResetAt: null,
  sourceUrl: 'https://x.com/thsottiaux/status/123', publishedAt: '2026-09-01T00:00:00.000Z',
  detectedAt: '2026-09-01T00:00:00.000Z', reviewedAt: null, ...over,
});
const radarShell = (events: unknown[]) => ({
  version: 1,
  account: { username: 'thsottiaux', name: 'Tibo', userId: '1' },
  sync: { status: 'ok', intervalMinutes: 15, lastAttemptAt: '2026-09-01T00:00:00.000Z', lastSuccessAt: '2026-09-01T00:00:00.000Z' },
  events,
});

test('remaining computes countdown parts and expiry', () => {
  const now = Date.parse('2026-09-29T00:00:00.000Z');
  const r = remaining('2026-10-01T06:30:00.000Z', now);
  assert.ok(r);
  assert.equal(r.days, 2); assert.equal(r.hours, 6); assert.equal(r.minutes, 30);
  assert.equal(r.expired, false);
  const past = remaining('2026-09-28T00:00:00.000Z', now);
  assert.ok(past);
  assert.equal(past.expired, true); // 到零不宣称已重置,只标记 expired
  assert.equal(remaining('not-a-date', now), null);
});

test('safeSource only allows https x.com/twitter.com status paths', () => {
  assert.equal(safeSource('https://x.com/thsottiaux/status/123'), 'https://x.com/thsottiaux/status/123');
  assert.equal(safeSource('http://x.com/thsottiaux/status/123'), null);
  assert.equal(safeSource('https://evil.com/thsottiaux/status/123'), null);
  assert.equal(safeSource('https://x.com/anything/else'), null);
  assert.equal(safeSource('https://x.com/thsottiaux/status/123/extra'), null);
});

test('validateRadar accepts valid shell', () => {
  const shell = radarShell([baseEvent()]);
  assert.equal(validateRadar(shell), shell);
});

test('validateRadar rejects broken payloads', () => {
  assert.throws(() => validateRadar(null));
  assert.throws(() => validateRadar({ ...radarShell([]), version: 2 }));
  assert.throws(() => validateRadar({ ...radarShell([]), account: { username: 'other' } }));
  assert.throws(() => validateRadar({ ...radarShell([]), sync: { status: 'weird' } }));
  assert.throws(() => validateRadar(radarShell([baseEvent({ status: 'scheduled', resetAt: null })])));
  assert.throws(() => validateRadar(radarShell([baseEvent({ id: '' })])));
  assert.throws(() => validateRadar(radarShell([baseEvent({ publishedAt: 'nope' })])));
  assert.throws(() => validateRadar(radarShell(Array.from({ length: 1001 }, (_, i) => baseEvent({ id: 'e' + i })))));
});
