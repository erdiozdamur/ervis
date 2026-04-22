import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

const CSRF_COOKIE_NAME = 'ervis-admin-csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const IDEMPOTENCY_HEADER_NAME = 'x-idempotency-key';
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const IDEMPOTENCY_TTL_MS = 10 * 60_000;

type RateLimitBucket = { timestamps: number[] };

type IdempotencyEntry =
  | {
      state: 'pending';
      fingerprint: string;
      expiresAt: number;
    }
  | {
      state: 'completed';
      fingerprint: string;
      expiresAt: number;
      status: number;
      body: string;
      contentType: string;
    };

const rateLimitStore = new Map<string, RateLimitBucket>();
const idempotencyStore = new Map<string, IdempotencyEntry>();

function parseCookies(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const pairs = cookieHeader.split(';').map((item) => item.trim()).filter(Boolean);
  const cookies = new Map<string, string>();

  for (const pair of pairs) {
    const separator = pair.indexOf('=');
    if (separator <= 0) continue;
    const key = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    cookies.set(key, decodeURIComponent(value));
  }

  return cookies;
}

function clearExpiredEntries(now: number) {
  for (const [key, entry] of idempotencyStore.entries()) {
    if (entry.expiresAt <= now) {
      idempotencyStore.delete(key);
    }
  }
}

function checkRateLimit(actorId: string, pathname: string, now: number) {
  const key = `${actorId}:${pathname}`;
  const bucket = rateLimitStore.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);

  if (bucket.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitStore.set(key, bucket);
    return false;
  }

  bucket.timestamps.push(now);
  rateLimitStore.set(key, bucket);
  return true;
}

function validateOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) {
    return true;
  }

  try {
    const originHost = new URL(origin).host;
    const host = request.headers.get('host');
    return Boolean(host && originHost === host);
  } catch {
    return false;
  }
}

export function withCsrfToken<T extends Record<string, unknown>>(request: Request, payload: T, init?: ResponseInit) {
  const cookies = parseCookies(request);
  const existingToken = cookies.get(CSRF_COOKIE_NAME);
  const csrfToken = existingToken && existingToken.length >= 16 ? existingToken : randomUUID();

  const response = NextResponse.json({ ...payload, csrfToken }, init);

  if (csrfToken !== existingToken) {
    response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      sameSite: 'strict',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 8,
    });
  }

  return response;
}

export async function withAdminWriteProtection(request: Request, actorId: string, handler: () => Promise<NextResponse>) {
  const now = Date.now();
  clearExpiredEntries(now);

  const pathname = new URL(request.url).pathname;

  if (!checkRateLimit(actorId, pathname, now)) {
    return NextResponse.json({ message: 'Çok fazla istek gönderildi. Lütfen kısa süre sonra tekrar deneyin.' }, { status: 429 });
  }

  if (!validateOrigin(request)) {
    return NextResponse.json({ message: 'Geçersiz origin. İstek engellendi.' }, { status: 403 });
  }

  const cookies = parseCookies(request);
  const csrfCookie = cookies.get(CSRF_COOKIE_NAME);
  const csrfHeader = request.headers.get(CSRF_HEADER_NAME);

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return NextResponse.json({ message: 'CSRF doğrulaması başarısız oldu.' }, { status: 403 });
  }

  const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER_NAME);
  if (!idempotencyKey || idempotencyKey.trim().length < 8 || idempotencyKey.length > 200) {
    return NextResponse.json({ message: 'Idempotency anahtarı zorunludur.' }, { status: 428 });
  }

  const fingerprint = `${request.method}:${pathname}:${await request.clone().text()}`;
  const storeKey = `${actorId}:${idempotencyKey}`;
  const existingEntry = idempotencyStore.get(storeKey);

  if (existingEntry) {
    if (existingEntry.fingerprint !== fingerprint) {
      return NextResponse.json({ message: 'Idempotency anahtarı farklı bir işlemle kullanılmış.' }, { status: 409 });
    }

    if (existingEntry.state === 'pending') {
      return NextResponse.json({ message: 'Aynı istek hâlen işleniyor. Kısa süre sonra tekrar deneyin.' }, { status: 409 });
    }

    return new NextResponse(existingEntry.body, {
      status: existingEntry.status,
      headers: {
        'Content-Type': existingEntry.contentType,
        'X-Idempotency-Replayed': 'true',
      },
    });
  }

  idempotencyStore.set(storeKey, {
    state: 'pending',
    fingerprint,
    expiresAt: now + IDEMPOTENCY_TTL_MS,
  });

  try {
    const response = await handler();
    const body = await response.text();
    const contentType = response.headers.get('content-type') ?? 'application/json; charset=utf-8';

    idempotencyStore.set(storeKey, {
      state: 'completed',
      fingerprint,
      expiresAt: now + IDEMPOTENCY_TTL_MS,
      status: response.status,
      body,
      contentType,
    });

    return new NextResponse(body, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    idempotencyStore.delete(storeKey);
    throw error;
  }
}
