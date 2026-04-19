import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { prisma } from '@/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { authenticateUserWithPassword, registerUser } from '@/services/auth/auth-service';

test('authenticateUserWithPassword normalizes email and returns the auth user when credentials match', async () => {
  const userDelegate = prisma.user as unknown as {
    findUnique: (args: { where: { email: string } }) => Promise<unknown>;
  };
  const originalFindUnique = userDelegate.findUnique;
  const passwordHash = await hashPassword('Password123');
  let requestedEmail = '';

  userDelegate.findUnique = async ({ where }) => {
    requestedEmail = where.email;

    return {
      id: 'user_1',
      email: 'user@example.com',
      name: 'Erdi',
      image: null,
      emailVerified: null,
      passwordHash,
    };
  };

  try {
    const user = await authenticateUserWithPassword({
      email: ' USER@Example.com ',
      password: 'Password123',
    });

    assert.equal(requestedEmail, 'user@example.com');
    assert.deepEqual(user, {
      id: 'user_1',
      email: 'user@example.com',
      name: 'Erdi',
      image: null,
      emailVerified: null,
    });
  } finally {
    userDelegate.findUnique = originalFindUnique;
  }
});

test('registerUser returns a stable email-taken response on duplicate email conflicts', async () => {
  const userDelegate = prisma.user as unknown as {
    create: (args: { data: { email: string } }) => Promise<unknown>;
  };
  const originalCreate = userDelegate.create;
  let createdEmail = '';

  userDelegate.create = async ({ data }) => {
    createdEmail = data.email;

    const duplicateError = Object.assign(new Error('Duplicate email'), {
      code: 'P2002',
    });
    Object.setPrototypeOf(duplicateError, Prisma.PrismaClientKnownRequestError.prototype);
    throw duplicateError;
  };

  try {
    const result = await registerUser({
      name: 'Erdi',
      email: ' USED@Example.com ',
      password: 'Password123',
      confirmPassword: 'Password123',
    });

    assert.equal(createdEmail, 'used@example.com');
    assert.equal(result.ok, false);
    assert.equal(result.ok === false ? result.code : null, 'EMAIL_TAKEN');
    assert.equal(result.ok === false ? result.fieldErrors?.email : null, 'Farklı bir e-posta kullan ya da giriş yap.');
  } finally {
    userDelegate.create = originalCreate;
  }
});
