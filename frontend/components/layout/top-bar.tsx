'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function TopBar({ title }: { title: string }) {
  return (
    <div className="flex h-14 items-center justify-between border-b px-4">
      <h1 className="text-base font-semibold">{title}</h1>
      <Button className="bg-muted text-foreground" onClick={() => signOut({ callbackUrl: '/login' })}>Sign out</Button>
    </div>
  );
}
