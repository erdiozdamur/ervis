export const ADMIN_MANAGED_SECRET_KEYS = ['OPENAI_API_KEY', 'AUTH_SECRET'] as const;

export type AdminManagedSecretKey = (typeof ADMIN_MANAGED_SECRET_KEYS)[number];

export type SecretSource = 'env' | 'secret_manager';

export function isAdminManagedSecretKey(value: string): value is AdminManagedSecretKey {
  return ADMIN_MANAGED_SECRET_KEYS.includes(value as AdminManagedSecretKey);
}
