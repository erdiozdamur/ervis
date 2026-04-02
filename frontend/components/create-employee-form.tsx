'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function CreateEmployeeForm({ organizationId, teamId }: { organizationId: string; teamId: string }) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');

  return (
    <form
      className="mb-3 flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId, teamId, name, title }),
        });
        window.location.reload();
      }}
    >
      <input className="h-9 w-44 rounded border px-2 text-sm" placeholder="Employee name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="h-9 w-44 rounded border px-2 text-sm" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Button type="submit">Add Employee</Button>
    </form>
  );
}
