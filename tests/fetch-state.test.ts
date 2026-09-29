import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFetchUrl, nextRadarState } from '../src/model.ts';
import type { RadarState } from '../src/model.ts';
import type { RadarData } from '../src/types.ts';

const fakeRadar = (): RadarData => ({
  version: 1,
  account: { username: 'thsottiaux', name: 'n', userId: '1' },
  sync: { status: 'ok', intervalMinutes: 15, lastAttemptAt: '2026-01-01T00:00:00.000Z', lastSuccessAt: '2026-01-01T00:00:00.000Z' },
  events: [],
});

test('buildFetchUrl 在已有查询串的 URL 上追加参数而不破坏原查询', () => {
  assert.equal(buildFetchUrl('https://h.example/api?token=a&x=1', 123), 'https://h.example/api?token=a&x=1&refresh=123');
});

test('buildFetchUrl 为无查询串的 URL 追加 refresh 参数', () => {
  assert.equal(buildFetchUrl('https://h.example/api/radar.json', 5), 'https://h.example/api/radar.json?refresh=5');
});

test('nextRadarState 成功时同时记录 checkedAt 与 lastSuccessAt 并清除错误', () => {
  const prev: RadarState = { radar: null, checkedAt: 50, lastSuccessAt: 50, error: '更新失败，正在显示上次数据。' };
  const radar = fakeRadar();
  const next = nextRadarState(prev, radar, 100);
  assert.ok(next.radar === radar);
  assert.equal(next.checkedAt, 100);
  assert.equal(next.lastSuccessAt, 100);
  assert.equal(next.error, null);
});

test('nextRadarState 失败时推进 checkedAt 但保留 lastSuccessAt 与旧数据', () => {
  const radar = fakeRadar();
  const prev: RadarState = { radar, checkedAt: 50, lastSuccessAt: 50, error: null };
  const next = nextRadarState(prev, null, 200);
  assert.ok(next.radar === radar);
  assert.equal(next.checkedAt, 200);
  assert.equal(next.lastSuccessAt, 50);
  assert.ok(next.error);
});
