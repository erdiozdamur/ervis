import { SignInForm } from '@/components/auth/sign-in-form';
import { getSafeRedirectPath } from '@/lib/auth/redirect';

type SignInPageProps = {
  searchParams?: {
    next?: string | string[];
    email?: string | string[];
    notice?: string | string[];
  };
};

export default function SignInPage({ searchParams }: SignInPageProps) {
  const email = Array.isArray(searchParams?.email) ? searchParams?.email[0] : searchParams?.email;
  const noticeValue = Array.isArray(searchParams?.notice) ? searchParams?.notice[0] : searchParams?.notice;
  const notice =
    noticeValue === 'account-created'
      ? 'Hesabın hazır. Devam etmek için giriş yap.'
      : noticeValue === 'session-required'
        ? 'Devam etmek için giriş yap.'
        : null;

  return <SignInForm callbackUrl={getSafeRedirectPath(searchParams?.next)} defaultEmail={email} notice={notice} />;
}
