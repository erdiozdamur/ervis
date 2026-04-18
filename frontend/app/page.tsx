import { redirect } from 'next/navigation';
import { AUTH_APP_PATH, AUTH_SIGN_IN_PATH } from '@/lib/auth/constants';
import { getCurrentUser } from '@/lib/auth/session';

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(AUTH_APP_PATH);
  }

  redirect(`${AUTH_SIGN_IN_PATH}?next=${encodeURIComponent(AUTH_APP_PATH)}`);
}
