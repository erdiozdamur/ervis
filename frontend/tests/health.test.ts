import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '@/app/api/health/route';

test('health endpoint returns 200 and status ok', async () => {
  const response = await GET();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.status, 'ok');
  assert.equal(payload.timeZone, 'Europe/Istanbul');
  assert.equal(typeof payload.timestamp, 'string');
  assert.equal(typeof payload.dayKey, 'string');
});
