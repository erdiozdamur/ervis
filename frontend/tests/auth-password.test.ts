import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

test('hashPassword creates a verifiable hash', async () => {
  const password = 'CalmMeals2026';
  const hash = await hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});
