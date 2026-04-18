import assert from 'node:assert/strict';
import test from 'node:test';
import { signInSchema, signUpSchema } from '@/lib/auth/validation';

test('signInSchema normalizes email', () => {
  const parsed = signInSchema.parse({
    email: ' USER@Example.com ',
    password: 'Password123',
  });

  assert.equal(parsed.email, 'user@example.com');
});

test('signUpSchema requires matching passwords', () => {
  const parsed = signUpSchema.safeParse({
    name: 'Erdi',
    email: 'user@example.com',
    password: 'Password123',
    confirmPassword: 'Password999',
  });

  assert.equal(parsed.success, false);
});
