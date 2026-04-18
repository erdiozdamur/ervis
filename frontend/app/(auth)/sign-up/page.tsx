import { SignUpForm } from '@/components/auth/sign-up-form';
import { getSafeRedirectPath } from '@/lib/auth/redirect';

type SignUpPageProps = {
  searchParams?: {
    next?: string | string[];
  };
};

export default function SignUpPage({ searchParams }: SignUpPageProps) {
  return <SignUpForm callbackUrl={getSafeRedirectPath(searchParams?.next)} />;
}
