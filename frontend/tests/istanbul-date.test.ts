import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatTimeInputInAppTimeZone,
  getAppDateTimeFromDayKeyAndTime,
  getAppDayKey,
  isValidAppDayKey,
  shiftAppDayKey,
} from '@/lib/date/istanbul';

test('getAppDateTimeFromDayKeyAndTime preserves Istanbul-local day and time', () => {
  const date = getAppDateTimeFromDayKeyAndTime('2026-04-17', '19:45');

  assert.equal(getAppDayKey(date), '2026-04-17');
  assert.equal(formatTimeInputInAppTimeZone(date), '19:45');
});

test('shiftAppDayKey moves one Istanbul-local day at a time', () => {
  assert.equal(shiftAppDayKey('2026-04-17', -1), '2026-04-16');
  assert.equal(shiftAppDayKey('2026-04-17', 1), '2026-04-18');
});

test('isValidAppDayKey rejects malformed day keys', () => {
  assert.equal(isValidAppDayKey('2026-04-17'), true);
  assert.equal(isValidAppDayKey('2026-13-17'), false);
  assert.equal(isValidAppDayKey('17-04-2026'), false);
});
