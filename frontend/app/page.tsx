import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  try {
    const session = await auth();
    redirect(session?.user?.id ? '/dashboard' : '/login');
  } catch (error) {
    console.error('[home] auth lookup failed, falling back to /login', error);
    redirect('/login');
  }
}
