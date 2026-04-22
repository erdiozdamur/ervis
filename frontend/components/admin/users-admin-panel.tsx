'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UserRole } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatePanel } from '@/components/ui/state-panel';
import { StatusPill } from '@/components/ui/status-pill';
import { createMutationHeaders } from '@/lib/security/mutation-request';
import { AdminModuleHeader } from '@/components/admin/admin-module-header';

type EditableUserRole = Exclude<UserRole, 'OWNER'>;

const ROLE_OPTIONS: EditableUserRole[] = ['USER', 'ADMIN', 'SUPER_ADMIN'];

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  guards: {
    canManage: boolean;
    canChangeRole: boolean;
    canToggleActive: boolean;
    isSelf: boolean;
    wouldBreakLastAdmin: boolean;
  };
};

type UsersResponse = {
  ok: true;
  csrfToken: string;
  users: UserRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type PendingAction =
  | { kind: 'role'; user: UserRow; nextRole: EditableUserRole }
  | { kind: 'status'; user: UserRow; nextActive: boolean };

const PAGE_SIZE = 10;

export function UsersAdminPanel() {
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PASSIVE'>('ALL');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [fourEyesApproverEmail, setFourEyesApproverEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const [info, setInfo] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const params = new URLSearchParams();
      if (q.trim()) {
        params.set('q', q.trim());
      }
      if (roleFilter !== 'ALL') {
        params.set('role', roleFilter);
      }
      if (statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));

      const response = await fetch(`/api/admin/users?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Kullanıcı listesi alınamadı.');
      }

      setData(payload as UsersResponse);
      setCsrfToken((payload as UsersResponse).csrfToken);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Bilinmeyen hata.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, q, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const totalPages = data?.pagination.totalPages ?? 1;
  const hasUsers = Boolean(data?.users.length);
  const canManageUsers = data?.users.some((user) => user.guards.canManage) ?? false;

  const formTitle = useMemo(() => {
    if (!pendingAction) {
      return '';
    }

    if (pendingAction.kind === 'role') {
      return 'Rol değişikliği onayı';
    }

    return pendingAction.nextActive ? 'Kullanıcıyı aktifleştir' : 'Kullanıcıyı pasifleştir';
  }, [pendingAction]);

  async function submitAction() {
    if (!pendingAction) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setInfo(null);

    try {
      const endpoint =
        pendingAction.kind === 'role'
          ? `/api/admin/users/${pendingAction.user.id}/role`
          : `/api/admin/users/${pendingAction.user.id}/status`;

      const body =
        pendingAction.kind === 'role'
          ? { role: pendingAction.nextRole, reason, confirm: confirmText, fourEyesApproverEmail }
          : { isActive: pendingAction.nextActive, reason, confirm: confirmText, fourEyesApproverEmail };

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: createMutationHeaders(csrfToken),
        body: JSON.stringify(body),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message ?? 'İşlem başarısız oldu.');
      }

      setPendingAction(null);
      setConfirmText('');
      setReason('');
      setFourEyesApproverEmail('');
      setInfo('Kullanıcı güncellemesi başarıyla uygulandı.');
      await fetchUsers();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'İşlem başarısız oldu.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <AdminModuleHeader
        title="Kullanıcılar"
        description="Kullanıcıların rol ve aktiflik durumlarını buradan yönetirsiniz."
        hint="Desktop kullanımında üstte filtreleyip alttaki tablo üzerinden işlem yapabilirsiniz."
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-4 lg:p-5">
        <div className="grid gap-3 lg:grid-cols-5 lg:items-end">
          <div className="space-y-1 lg:col-span-2">
            <label htmlFor="users-search" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Kullanıcı ara
            </label>
            <Input
              id="users-search"
              value={q}
              onChange={(event) => {
                setPage(1);
                setQ(event.target.value);
              }}
              placeholder="İsim veya e-posta ile ara"
              className="h-12"
            />
          </div>

          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Rol filtresi
            <select
              value={roleFilter}
              onChange={(event) => {
                setPage(1);
                setRoleFilter(event.target.value as 'ALL' | UserRole);
              }}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-900"
            >
              <option value="ALL">Tüm roller</option>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              <option value="OWNER">OWNER</option>
            </select>
          </label>

          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Durum filtresi
            <select
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value as 'ALL' | 'ACTIVE' | 'PASSIVE');
              }}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-900"
            >
              <option value="ALL">Tüm durumlar</option>
              <option value="ACTIVE">Aktif</option>
              <option value="PASSIVE">Pasif</option>
            </select>
          </label>

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setQ('');
                setRoleFilter('ALL');
                setStatusFilter('ALL');
                setPage(1);
              }}
            >
              Filtreleri temizle
            </Button>
          </div>
        </div>
      </div>

      {loading ? <StatePanel variant="loading" title="Kullanıcılar yükleniyor" description="Liste hazırlanıyor..." /> : null}
      {error ? <StatePanel variant="error" title="İşlem hatası" description={error} /> : null}
      {info ? <StatePanel variant="success" title="İşlem sonucu" description={info} /> : null}
      {!loading && !error && !canManageUsers ? (
        <StatePanel
          variant="empty"
          title="Yazma yetkiniz yok"
          description="Rol ve aktiflik değişiklikleri için SUPER_ADMIN veya OWNER rolü gerekir."
        />
      ) : null}

      {!loading && !error && !hasUsers ? (
        <StatePanel variant="empty" title="Kullanıcı bulunamadı" description="Filtreleri temizleyip tekrar deneyin." />
      ) : null}

      {!loading && !error && hasUsers ? (
        <div className="rounded-3xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Kullanıcı</th>
                  <th className="px-5 py-3">Rol</th>
                  <th className="px-5 py-3">Durum</th>
                  <th className="px-5 py-3">Aksiyonlar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.users.map((user) => (
                  <tr key={user.id} className="align-top">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">{user.name ?? 'İsimsiz kullanıcı'}</div>
                      <div className="text-slate-600">{user.email}</div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone="neutral">{user.role}</StatusPill>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={user.isActive ? 'success' : 'neutral'}>{user.isActive ? 'Aktif' : 'Pasif'}</StatusPill>
                    </td>
                    <td className="space-y-2 px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {ROLE_OPTIONS.map((nextRole) => (
                          <Button
                            key={nextRole}
                            size="sm"
                            variant={nextRole === user.role ? 'soft' : 'secondary'}
                            disabled={nextRole === user.role || !user.guards.canChangeRole}
                            onClick={() => setPendingAction({ kind: 'role', user, nextRole })}
                          >
                            {nextRole}
                          </Button>
                        ))}
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!user.guards.canToggleActive}
                        onClick={() => setPendingAction({ kind: 'status', user, nextActive: !user.isActive })}
                      >
                        {user.isActive ? 'Pasife al' : 'Aktife al'}
                      </Button>

                      {user.guards.isSelf ? <p className="text-xs text-amber-700">Kendi hesabında işlem yapamazsın.</p> : null}
                      {user.guards.wouldBreakLastAdmin ? <p className="text-xs text-amber-700">Son aktif admin korunuyor.</p> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
            <p className="text-sm text-slate-600">Toplam: {data?.pagination.total ?? 0}</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                Önceki
              </Button>
              <span className="text-sm text-slate-600">
                Sayfa {page} / {totalPages}
              </span>
              <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
                Sonraki
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingAction ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 lg:p-5">
          <h3 className="text-base font-semibold text-slate-900">{formTitle}</h3>
          <p className="mt-1 text-sm text-slate-600">İşlemi tamamlamak için gerekçe (min 10 karakter) girip ONAYLA yazın.</p>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-3 text-sm">
              <p className="text-slate-700">
                <strong>{pendingAction.user.email}</strong> için{' '}
                {pendingAction.kind === 'role'
                  ? `rol ${pendingAction.user.role} -> ${pendingAction.nextRole}`
                  : pendingAction.nextActive
                    ? 'hesabı aktifleştirme'
                    : 'hesabı pasifleştirme'}{' '}
                işlemi yapılacak.
              </p>

              <Input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder="ONAYLA" className="h-12" />
              <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Gerekçe (zorunlu, min 10 karakter)" className="h-12" />
              <Input
                value={fourEyesApproverEmail}
                onChange={(event) => setFourEyesApproverEmail(event.target.value)}
                placeholder="4-eyes için SUPER_ADMIN e-posta (opsiyonel)"
                className="h-12"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Button
                size="md"
                onClick={submitAction}
                disabled={confirmText.trim().toUpperCase() !== 'ONAYLA' || reason.trim().length < 10 || submitting}
              >
                {submitting ? 'Kaydediliyor...' : 'Onayla ve uygula'}
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setPendingAction(null);
                  setConfirmText('');
                  setReason('');
                  setFourEyesApproverEmail('');
                }}
                disabled={submitting}
              >
                Vazgeç
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
