import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshAnnounced, mergeSeen, announceMessage, isAnnounced, seenKey } from '../src/notify.ts';
import type { RadarEvent } from '../src/types.ts';

const ev = (over: Partial<RadarEvent> = {}): RadarEvent => ({
  id: 'e1', type: 'reset', status: 'completed', title: '重置了', summary: '已重置',
  audience: null, text: 'reset', translation: null, resetAt: null, suggestedResetAt: null,
  sourceUrl: 'https://x.com/thsottiaux/status/1', publishedAt: '2026-09-29T06:00:00.000Z',
  detectedAt: '2026-09-29T06:00:00.000Z', reviewedAt: null, ...over,
});
const NOW = Date.parse('2026-09-29T12:00:00.000Z');
const SINCE = Date.parse('2026-09-20T00:00:00.000Z'); // installedAt

test('isAnnounced covers completed reset/card and scheduled', () => {
  assert.equal(isAnnounced(ev()), true);
  assert.equal(isAnnounced(ev({ type: 'card' })), true);
  assert.equal(isAnnounced(ev({ status: 'scheduled', resetAt: '2026-10-01T00:00:00.000Z' })), true);
  assert.equal(isAnnounced(ev({ status: 'candidate' })), false);
  assert.equal(isAnnounced(ev({ status: 'dismissed' })), false);
});

test('freshAnnounced filters by 24h window, since, and seen keys', () => {
  const events = [
    ev({ id: 'fresh' }),                                                        // 命中
    ev({ id: 'old', publishedAt: '2026-09-27T00:00:00.000Z' }),                 // 超 24h,排除(防历史回填风暴)
    ev({ id: 'before-install', publishedAt: '2026-09-19T00:00:00.000Z' }),      // 早于 installedAt,排除
    ev({ id: 'seen', publishedAt: '2026-09-29T07:00:00.000Z' }),                // 已看过,排除
    ev({ id: 'cand', status: 'candidate' }),                                    // 非公告,排除
  ];
  const fresh = freshAnnounced(events, ['completed:seen'], SINCE, NOW);
  assert.deepEqual(fresh.map(e => e.id), ['fresh']);
});

test('seen key is id:status so scheduled→completed transition re-notifies', () => {
  const scheduled = ev({ id: 'x', status: 'scheduled', resetAt: '2026-09-29T18:00:00.000Z' });
  const done = ev({ id: 'x', status: 'completed' });
  assert.notEqual(seenKey(scheduled), seenKey(done));
  const fresh = freshAnnounced([done], [seenKey(scheduled)], SINCE, NOW);
  assert.deepEqual(fresh.map(e => e.id), ['x']);
});

test('mergeSeen dedupes and caps at 1000 keeping newest', () => {
  const many = Array.from({ length: 1200 }, (_, i) => 'completed:e' + i);
  const merged = mergeSeen(['completed:old'], many);
  assert.equal(merged.length, 1000);
  assert.ok(merged.includes('completed:e1199'));
  assert.ok(!merged.includes('completed:old'));
  assert.deepEqual(mergeSeen(['a'], ['a', 'b']), ['a', 'b']);
});

test('announceMessage builds zh title from status/type', () => {
  assert.equal(announceMessage(ev()).title, 'Codex 有新的重置公告');
  assert.equal(announceMessage(ev({ type: 'card' })).title, 'Codex 有新的发卡公告');
  assert.equal(announceMessage(ev({ status: 'scheduled', resetAt: '2026-10-01T00:00:00.000Z' })).title, 'Codex 有新的重置预告');
  assert.equal(announceMessage(ev({ summary: null })).body, '重置了');
});
