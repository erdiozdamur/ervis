'use client';

import { useEffect, useState, useTransition } from 'react';
import { Role } from '@prisma/client';

type RoleAssignment = {
  role: Role;
};

type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  roles: RoleAssignment[];
};

type UsersResponse = {
  ok: boolean;
  users?: AdminUserRow[];
  message?: string;
};

type MutationResponse = {
  ok: boolean;
  message?: string;
};

const DEFAULT_ROLE = Role.USER;

export function UserRoleManager({ actorUserId, roles }: { actorUserId: string; roles: Role[] }) {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, Role>>({});
  const [isPending, startTransition] = useTransition();

  async function loadUsers() {
    const response = await fetch('/api/admin/users', { method: 'GET' });
    const payload = (await response.json().catch(() => ({}))) as UsersResponse;

    if (!response.ok || !payload.ok || !payload.users) {
      setError(payload.message ?? 'Kullanıcı listesi alınamadı.');
      return;
    }

    setError(null);
    setUsers(payload.users);
    setSelectedRoles((previous) => {
      const next = { ...previous };

      for (const user of payload.users ?? []) {
        if (!next[user.id]) {
          next[user.id] = DEFAULT_ROLE;
        }
      }

      return next;
    });
  }

  async function assignRole(targetUserId: string) {
    const role = selectedRoles[targetUserId] ?? DEFAULT_ROLE;
    const response = await fetch(`/api/admin/users/${targetUserId}/roles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role }),
    });

    const payload = (await response.json().catch(() => ({}))) as MutationResponse;

    if (!response.ok || !payload.ok) {
      setError(payload.message ?? 'Rol atanamadı.');
      return;
    }

    await loadUsers();
  }

  async function removeRole(targetUserId: string, role: Role) {
    const response = await fetch(`/api/admin/users/${targetUserId}/roles`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role }),
    });

    const payload = (await response.json().catch(() => ({}))) as MutationResponse;

    if (!response.ok || !payload.ok) {
      setError(payload.message ?? 'Rol kaldırılamadı.');
      return;
    }

    await loadUsers();
  }

  useEffect(() => {
    startTransition(loadUsers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Kullanıcı rolleri buradan yönetilir.</p>
        <button
          type="button"
          onClick={() => startTransition(loadUsers)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
          disabled={isPending}
        >
          {isPending ? 'Yükleniyor…' : 'Listeyi yenile'}
        </button>
      </div>

      {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Kullanıcı</th>
              <th className="px-3 py-2">Roller</th>
              <th className="px-3 py-2">Rol Ata</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-900">{user.name || 'İsimsiz kullanıcı'}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    {user.roles.length === 0 ? <span className="text-xs text-slate-400">Rol yok</span> : null}
                    {user.roles.map((entry) => (
                      <button
                        key={entry.role}
                        type="button"
                        className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                        onClick={() => startTransition(() => removeRole(user.id, entry.role))}
                        disabled={isPending || actorUserId === user.id}
                        title={actorUserId === user.id ? 'Kendi rollerini kaldıramazsın.' : 'Rolü kaldır'}
                      >
                        {entry.role}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-lg border border-slate-300 px-2 py-1"
                      value={selectedRoles[user.id] ?? DEFAULT_ROLE}
                      onChange={(event) => {
                        const role = event.target.value as Role;
                        setSelectedRoles((previous) => ({ ...previous, [user.id]: role }));
                      }}
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                      onClick={() => startTransition(() => assignRole(user.id))}
                      disabled={isPending}
                    >
                      Ata
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
