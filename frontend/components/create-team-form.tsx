'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function CreateTeamForm({ organizationId }: { organizationId: string }) {
  const [name, setName] = useState('');
  return (
    <form
      className="mb-3 flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        await fetch('/api/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId, name }) });
        window.location.reload();
      }}
    >
      <input className="h-9 w-64 rounded border px-2 text-sm" placeholder="Create team" value={name} onChange={(e) => setName(e.target.value)} />
      <Button type="submit">Add Team</Button>
    </form>
  );
}
