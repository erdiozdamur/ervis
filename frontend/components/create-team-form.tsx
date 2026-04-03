'use client';

import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CreateTeamForm({ organizationId }: { organizationId: string }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const createTeam = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await fetch('/api/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId, name }) });
    setSaving(false);
    window.location.reload();
  };

  return (
    <form
      className="app-surface mb-3 flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        await createTeam();
      }}
    >
      <div className="flex-1">
        <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
          <Users size={14} />
          Add Team
        </label>
        <input className="field" placeholder="Team name..." value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button type="submit" className="sm:min-w-36" disabled={saving || !name.trim()}>
        <Plus size={14} />
        {saving ? 'Adding...' : 'Add Team'}
      </Button>
    </form>
  );
}
