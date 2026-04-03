'use client';

import { useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CreateOrganizationForm() {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const createOrganization = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    window.location.reload();
  };

  return (
    <form
      className="app-surface mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        await createOrganization();
      }}
    >
      <div className="flex-1">
        <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
          <Building2 size={14} />
          New Organization
        </label>
        <input
          className="field"
          placeholder="Type an organization name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <Button type="submit" className="sm:min-w-40" disabled={saving || !name.trim()}>
        <Plus size={15} />
        {saving ? 'Creating...' : 'Create Organization'}
      </Button>
    </form>
  );
}
