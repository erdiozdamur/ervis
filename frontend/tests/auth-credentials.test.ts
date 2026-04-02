import test from 'node:test';
import assert from 'node:assert/strict';
import { loginSchema, registerSchema } from '@/server/auth/credentials';
import { hashPassword, verifyPassword } from '@/server/auth/password';

test('register schema rejects weak passwords and mismatched confirmation', () => {
  const weak = registerSchema.safeParse({
    name: 'User',
    email: 'user@example.com',
    password: 'short',
    confirmPassword: 'short',
  });
  assert.equal(weak.success, false);

  const mismatch = registerSchema.safeParse({
    name: 'User',
    email: 'user@example.com',
    password: 'Password123',
    confirmPassword: 'Password321',
  });
  assert.equal(mismatch.success, false);
});

test('login schema accepts basic credential payload', () => {
  const parsed = loginSchema.safeParse({ email: 'user@example.com', password: 'test-password' });
  assert.equal(parsed.success, true);
});

test('password hashing verifies the right password only', async () => {
  const hashed = await hashPassword('Password123');
  assert.equal(await verifyPassword('Password123', hashed), true);
  assert.equal(await verifyPassword('WrongPassword123', hashed), false);
});
