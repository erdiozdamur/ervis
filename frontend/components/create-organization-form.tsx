'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function CreateOrganizationForm() {
  const [name, setName] = useState('');

  return (
    <form
      className="mb-4 flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        await fetch('/api/organizations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        window.location.reload();
      }}
    >
      <input className="h-10 w-80 rounded-md border px-3 text-sm" placeholder="New organization name" value={name} onChange={(e) => setName(e.target.value)} />
      <Button type="submit">Create</Button>
    </form>
  );
}
