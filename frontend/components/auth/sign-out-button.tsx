'use client';

import { useTransition } from 'react';
import { signOut } from 'next-auth/react';
import { buttonStyles } from '@/components/ui/button';

type SignOutButtonProps = {
  fullWidth?: boolean;
};

export function SignOutButton({ fullWidth = false }: SignOutButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={buttonStyles({ variant: 'secondary', size: 'md', fullWidth })}
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await signOut({ callbackUrl: '/' });
        });
      }}
    >
      {isPending ? 'Çıkış yapılıyor...' : 'Çıkış yap'}
    </button>
  );
}
