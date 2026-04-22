import { revalidatePath } from 'next/cache';
import { prisma } from '@/db/prisma';
import { getServerEnv } from '@/lib/env';
import { listAgentPromptConfigs, updateAgentPromptText } from '@/services/ai-agent-prompt-service';

function formatDateTime(value: Date | null) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

async function savePromptAction(formData: FormData) {
  'use server';

  const key = String(formData.get('key') ?? '');
  const text = String(formData.get('text') ?? '');

  await updateAgentPromptText({ key, text });
  revalidatePath('/app/admin');
}

export default async function AdminPage() {
  const now = new Date();
  const env = getServerEnv();

  const [users, prompts] = await Promise.all([
    prisma.user.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        sessions: {
          where: {
            expires: {
              gt: now,
            },
          },
          select: {
            expires: true,
          },
          orderBy: {
            expires: 'desc',
          },
          take: 1,
        },
      },
      take: 100,
    }),
    listAgentPromptConfigs(),
  ]);

  return (
    <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2 px-8 pb-8">
      <main className="mx-auto min-w-[1240px] max-w-[1800px] space-y-8">
        <header className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin Paneli</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Sistem Yönetim Merkezi</h1>
          <p className="mt-2 text-sm text-slate-600">Bu ekran artık dummy veri yerine veritabanından gerçek kullanıcı/prompt verilerini gösterir.</p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm" aria-labelledby="user-management-title">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 id="user-management-title" className="text-2xl font-semibold text-slate-900">
                1) Kullanıcı Yönetimi
              </h2>
              <p className="mt-1 text-sm text-slate-600">Sistemde kayıtlı kullanıcılar listelenir.</p>
            </div>
          </div>

          <table className="w-full border-collapse overflow-hidden rounded-xl border border-slate-200 bg-white text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">ID</th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ad Soyad</th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">E-posta</th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Durum</th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Oluşturulma</th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Son Güncelleme</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isActive = user.sessions.length > 0;
                return (
                  <tr key={user.id} className="hover:bg-slate-50/80">
                    <td className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">{user.id}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-900">{user.name?.trim() || '—'}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">{user.email}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">{formatDateTime(user.createdAt)}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">{formatDateTime(user.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm" aria-labelledby="prompt-management-title">
          <div className="mb-6">
            <h2 id="prompt-management-title" className="text-2xl font-semibold text-slate-900">
              2) AI Agent Prompt Yönetimi
            </h2>
            <p className="mt-1 text-sm text-slate-600">Kodda tanımlı promptlar listelenir; buradan metinleri güncelleyebilirsiniz. Yeni prompt ekleme kaldırıldı.</p>
          </div>

          <div className="space-y-4">
            {prompts.map((prompt) => (
              <form key={prompt.key} action={savePromptAction} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <input type="hidden" name="key" value={prompt.key} />
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{prompt.agent}</p>
                    <p className="text-xs text-slate-600">{prompt.scope}</p>
                    <p className="mt-1 text-xs text-slate-500">Model: {env[prompt.modelEnvKey]} · Anahtar: {prompt.key}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Son güncelleme: {formatDateTime(prompt.updatedAt)}</p>
                    <p className="text-xs text-slate-500">Kaynak: {prompt.isCustom ? 'Admin override' : 'Kod varsayılanı'}</p>
                  </div>
                </div>
                <textarea
                  name="text"
                  defaultValue={prompt.promptText}
                  rows={5}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 transition focus:ring-2"
                />
                <div className="mt-3 flex justify-end">
                  <button type="submit" className="rounded-md border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
                    Promptu Kaydet
                  </button>
                </div>
              </form>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
