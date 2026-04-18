import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_PARAMETERS = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
};

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH);

  return [
    'scrypt',
    String(SCRYPT_PARAMETERS.N),
    String(SCRYPT_PARAMETERS.r),
    String(SCRYPT_PARAMETERS.p),
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, serializedHash: string) {
  const [algorithm, rawN, rawR, rawP, saltValue, expectedValue] = serializedHash.split('$');

  if (algorithm !== 'scrypt' || !rawN || !rawR || !rawP || !saltValue || !expectedValue) {
    return false;
  }

  const salt = Buffer.from(saltValue, 'base64url');
  const expected = Buffer.from(expectedValue, 'base64url');
  const derivedKey = await scryptAsync(password, salt, expected.length, {
    N: Number(rawN),
    r: Number(rawR),
    p: Number(rawP),
    maxmem: 32 * 1024 * 1024,
  });

  return timingSafeEqual(derivedKey, expected);
}

function scryptAsync(password: string, salt: Buffer, keyLength: number, options = SCRYPT_PARAMETERS) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey as Buffer);
    });
  });
}
