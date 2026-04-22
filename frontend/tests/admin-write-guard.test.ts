import test from 'node:test';
import assert from 'node:assert/strict';
import { NextResponse } from 'next/server';
import { withAdminWriteProtection, withCsrfToken } from '@/lib/security/admin-write-guard';

test('withCsrfToken attaches token to payload', async () => {
  const request = new Request('http://localhost:3000/api/admin/users');
  const response = withCsrfToken(request, { ok: true }, { status: 200 });
  const payload = (await response.json()) as { ok: boolean; csrfToken: string };

  assert.equal(payload.ok, true);
  assert.equal(typeof payload.csrfToken, 'string');
  assert.ok(payload.csrfToken.length > 10);
});

test('withAdminWriteProtection rejects requests without csrf/idempotency headers', async () => {
  const request = new Request('http://localhost:3000/api/admin/app-settings', {
    method: 'PUT',
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ timeZone: 'Europe/Istanbul' }),
  });

  const response = await withAdminWriteProtection(request, 'actor-1', async () => NextResponse.json({ ok: true }));
  assert.equal(response.status, 403);
});
