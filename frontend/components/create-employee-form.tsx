'use client';

import { useState } from 'react';
import { Plus, UserPlus2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CreateEmployeeForm({ organizationId, teamId }: { organizationId: string; teamId: string }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const createEmployee = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, teamId, name }),
    });
    setSaving(false);
    window.location.reload();
  };

  return (
    <form
      className="app-surface mb-3 flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        await createEmployee();
      }}
    >
      <div className="flex-1">
        <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
          <UserPlus2 size={14} />
          Add Employee
        </label>
        <input className="field" placeholder="Employee name..." value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button type="submit" className="sm:min-w-44" disabled={saving || !name.trim()}>
        <Plus size={14} />
        {saving ? 'Adding...' : 'Add Employee'}
      </Button>
    </form>
  );
}
