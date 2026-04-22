export default function AdminPage() {
  const users = [
    {
      id: 'USR-1041',
      name: 'Ayşe Yılmaz',
      email: 'ayse.yilmaz@ervis.ai',
      role: 'Admin',
      status: 'Aktif',
      lastSeen: '22 Nis 2026, 09:42',
    },
    {
      id: 'USR-2118',
      name: 'Mert Aydın',
      email: 'mert.aydin@ervis.ai',
      role: 'Editör',
      status: 'Aktif',
      lastSeen: '22 Nis 2026, 08:16',
    },
    {
      id: 'USR-3082',
      name: 'Zeynep Demir',
      email: 'zeynep.demir@ervis.ai',
      role: 'Operasyon',
      status: 'Pasif',
      lastSeen: '20 Nis 2026, 17:02',
    },
  ];

  const prompts = [
    {
      id: 'PRM-01',
      agent: 'Meal Analyzer Agent',
      scope: 'Yemek görsel analizi',
      model: 'gpt-4.1-mini',
      updatedAt: '21 Nis 2026, 15:11',
      updatedBy: 'ayse.yilmaz@ervis.ai',
    },
    {
      id: 'PRM-02',
      agent: 'Meal Review Agent',
      scope: 'Onay öncesi kalite kontrol',
      model: 'gpt-4.1',
      updatedAt: '22 Nis 2026, 10:05',
      updatedBy: 'mert.aydin@ervis.ai',
    },
    {
      id: 'PRM-03',
      agent: 'Nutrition Advice Agent',
      scope: 'Beslenme öneri üretimi',
      model: 'gpt-4.1-mini',
      updatedAt: '19 Nis 2026, 13:24',
      updatedBy: 'zeynep.demir@ervis.ai',
    },
  ];

  return (
    <main className="overflow-x-auto pb-10">
      <div className="min-w-[1240px] space-y-8">
        <header className="rounded-2xl border border-slate-200 bg-white px-8 py-7 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin Paneli</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Sistem Yönetim Merkezi</h1>
          <p className="mt-2 max-w-4xl text-sm text-slate-600">
            Bu ekran desktop öncelikli planlandı. Görünüm tamamen yönetim amaçlı bağımsız bir frontend düzeninde hazırlandı.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm" aria-labelledby="user-management-title">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 id="user-management-title" className="text-2xl font-semibold text-slate-900">
                1) Kullanıcı Yönetimi
              </h2>
              <p className="mt-1 text-sm text-slate-600">Kullanıcı listeleme, ekleme, değiştirme ve silme.</p>
            </div>
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              + Kullanıcı Ekle
            </button>
          </div>

          <div className="mb-5 grid grid-cols-[1.3fr_1.3fr_1fr_1fr] gap-4">
            <input
              type="text"
              placeholder="Ad / Soyad ara"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 transition focus:ring-2"
            />
            <input
              type="email"
              placeholder="E-posta ile ara"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 transition focus:ring-2"
            />
            <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 transition focus:ring-2">
              <option>Tüm roller</option>
              <option>Admin</option>
              <option>Editör</option>
              <option>Operasyon</option>
            </select>
            <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 transition focus:ring-2">
              <option>Tüm durumlar</option>
              <option>Aktif</option>
              <option>Pasif</option>
            </select>
          </div>

          <table className="w-full border-collapse overflow-hidden rounded-xl border border-slate-200 bg-white text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">ID</th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ad Soyad</th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">E-posta</th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Rol</th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Durum</th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Son Görülme</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/80">
                  <td className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">{user.id}</td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-900">{user.name}</td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">{user.email}</td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">{user.role}</td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        user.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">{user.lastSeen}</td>
                  <td className="border-b border-slate-100 px-4 py-3 text-right text-sm">
                    <button type="button" className="mr-2 rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100">
                      Düzenle
                    </button>
                    <button type="button" className="rounded-md border border-rose-300 px-3 py-1.5 text-rose-600 hover:bg-rose-50">
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm" aria-labelledby="prompt-management-title">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 id="prompt-management-title" className="text-2xl font-semibold text-slate-900">
                2) AI Agent Prompt Yönetimi
              </h2>
              <p className="mt-1 text-sm text-slate-600">Sistemdeki tüm AI araç/agent promptlarını listeleme ve değiştirme alanı.</p>
            </div>
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              + Yeni Prompt
            </button>
          </div>

          <table className="w-full border-collapse overflow-hidden rounded-xl border border-slate-200 bg-white text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Prompt ID</th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Agent</th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Kapsam</th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Model</th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Güncelleme Tarihi</th>
                <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Güncelleyen</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {prompts.map((prompt) => (
                <tr key={prompt.id} className="hover:bg-slate-50/80">
                  <td className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">{prompt.id}</td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-900">{prompt.agent}</td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">{prompt.scope}</td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">{prompt.model}</td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">{prompt.updatedAt}</td>
                  <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-700">{prompt.updatedBy}</td>
                  <td className="border-b border-slate-100 px-4 py-3 text-right text-sm">
                    <button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100">
                      Promptu Düzenle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
