import { AUTH_APP_PATH } from '@/lib/auth/constants';

export function getSafeRedirectPath(value: string | string[] | undefined, fallback = AUTH_APP_PATH) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate) {
    return fallback;
  }

  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.startsWith('/api/auth')) {
    return fallback;
  }

  return candidate;
}
