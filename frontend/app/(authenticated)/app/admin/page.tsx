import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Stack } from '@/components/layout/stack';
import { buttonStyles } from '@/components/ui/button';
import { StatePanel } from '@/components/ui/state-panel';
import { PromptStudioPanel } from '@/components/admin/prompt-studio-panel';
import { UsersAdminPanel } from '@/components/admin/users-admin-panel';
import { AppSettingsPanel } from '@/components/admin/app-settings-panel';
import { AuditLogsPanel } from '@/components/admin/audit-logs-panel';
import { OverviewPanel } from '@/components/admin/overview-panel';
import { RolesPermissionsPanel } from '@/components/admin/roles-permissions-panel';
import { FeatureFlagsPanel } from '@/components/admin/feature-flags-panel';
import { SystemStatusPanel } from '@/components/admin/system-status-panel';
import { isAdminRole } from '@/lib/auth/admin';
import { requireCurrentUser } from '@/lib/auth/session';
import { cn } from '@/lib/utils/cn';

const ADMIN_TABS = [
  { key: 'genel-bakis', label: 'Genel Bakış' },
  { key: 'kullanicilar', label: 'Kullanıcılar' },
  { key: 'roller-yetkiler', label: 'Roller ve Yetkiler' },
  { key: 'ai-ayarlari', label: 'Yapay Zekâ Ayarları' },
  { key: 'prompt-yonetimi', label: 'İstem Yönetimi' },
  { key: 'uygulama-ayarlari', label: 'Uygulama Ayarları' },
  { key: 'ozellik-yonetimi', label: 'Özellik Yönetimi' },
  { key: 'sistem-durumu', label: 'Sistem Durumu' },
  { key: 'degisiklik-gecmisi', label: 'Değişiklik Geçmişi' },
] as const;

type AdminTabKey = (typeof ADMIN_TABS)[number]['key'];

type AdminPageProps = {
  searchParams?: {
    tab?: string;
  };
};

function toAdminTab(value: string | undefined): AdminTabKey {
  if (!value) {
    return 'genel-bakis';
  }

  const matchedTab = ADMIN_TABS.find((tab) => tab.key === value);
  return matchedTab?.key ?? 'genel-bakis';
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const user = await requireCurrentUser();

  if (!isAdminRole(user.role)) {
    notFound();
  }

  const selectedTab = toAdminTab(searchParams?.tab);

  return (
    <Stack gap="lg">
      <ScreenHeader
        eyebrow="Yönetim"
        title="Yönetim Paneli"
        description="Teknik bilgisi olmayan ekip üyelerinin de güvenle yönetim yapabilmesi için sadeleştirilmiş yönetim alanı."
      />

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
        <nav aria-label="Yönetim bölümleri" className="rounded-3xl border border-slate-200 bg-white p-4 lg:sticky lg:top-24">
          <ul className="space-y-2">
            {ADMIN_TABS.map((tab) => {
              const isActive = tab.key === selectedTab;
              return (
                <li key={tab.key}>
                  <Link
                    href={`/app/admin?tab=${tab.key}`}
                    className={buttonStyles({
                      variant: isActive ? 'primary' : 'secondary',
                      size: 'sm',
                      className: cn('w-full justify-start rounded-2xl', isActive ? undefined : 'text-slate-600'),
                    })}
                  >
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <section className="min-w-0 space-y-5">
          {selectedTab === 'genel-bakis' ? (
            <OverviewPanel />
          ) : selectedTab === 'kullanicilar' ? (
            <UsersAdminPanel />
          ) : selectedTab === 'roller-yetkiler' ? (
            <RolesPermissionsPanel />
          ) : selectedTab === 'ai-ayarlari' ? (
            <PromptStudioPanel mode="ai" />
          ) : selectedTab === 'prompt-yonetimi' ? (
            <PromptStudioPanel mode="prompt" />
          ) : selectedTab === 'uygulama-ayarlari' ? (
            <AppSettingsPanel />
          ) : selectedTab === 'ozellik-yonetimi' ? (
            <FeatureFlagsPanel />
          ) : selectedTab === 'sistem-durumu' ? (
            <SystemStatusPanel />
          ) : selectedTab === 'degisiklik-gecmisi' ? (
            <AuditLogsPanel />
          ) : (
            <StatePanel variant="empty" title="Bölüm bulunamadı" description="Menüden geçerli bir admin modülü seçin." />
          )}
        </section>
      </div>
    </Stack>
  );
}
