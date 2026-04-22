const ADMIN_EMAILS = new Set(['e.ozdamur@gmail.com']);

export function isAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}
