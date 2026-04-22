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
import { isAdminRole } from '@/lib/auth/admin';
import { requireCurrentUser } from '@/lib/auth/session';
import { cn } from '@/lib/utils/cn';

const ADMIN_TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users', label: 'Users' },
  { key: 'ai-settings', label: 'AI Settings' },
  { key: 'prompt-studio', label: 'Prompt Studio' },
  { key: 'app-settings', label: 'App Settings' },
  { key: 'audit-logs', label: 'Audit Logs' },
] as const;

type AdminTabKey = (typeof ADMIN_TABS)[number]['key'];

type AdminPageProps = {
  searchParams?: {
    tab?: string;
  };
};

function toAdminTab(value: string | undefined): AdminTabKey {
  if (!value) {
    return 'dashboard';
  }

  const matchedTab = ADMIN_TABS.find((tab) => tab.key === value);
  return matchedTab?.key ?? 'dashboard';
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const user = await requireCurrentUser();

  if (!isAdminRole(user.role)) {
    notFound();
  }

  const selectedTab = toAdminTab(searchParams?.tab);
  const selectedLabel = ADMIN_TABS.find((tab) => tab.key === selectedTab)?.label ?? 'Dashboard';

  return (
    <Stack gap="lg">
      <ScreenHeader
        eyebrow="Admin"
        title="Admin Panel"
        description="Manage admin capabilities from one tabbed workspace and keep all admin modules consistent."
      />

      <nav aria-label="Admin sections" className="flex flex-wrap gap-2">
        {ADMIN_TABS.map((tab) => {
          const isActive = tab.key === selectedTab;
          return (
            <Link
              key={tab.key}
              href={`/app/admin?tab=${tab.key}`}
              className={buttonStyles({
                variant: isActive ? 'primary' : 'secondary',
                size: 'sm',
                className: cn('rounded-full', isActive ? undefined : 'text-slate-600'),
              })}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {selectedTab === 'users' ? (
        <UsersAdminPanel />
      ) : selectedTab === 'prompt-studio' ? (
        <PromptStudioPanel />
      ) : selectedTab === 'app-settings' ? (
        <AppSettingsPanel />
      ) : selectedTab === 'audit-logs' ? (
        <AuditLogsPanel />
      ) : (
        <StatePanel
          variant="empty"
          title={`${selectedLabel} is ready for implementation`}
          description="This tab is scaffolded. Empty, loading, and error states now follow one shared admin pattern until live data flows are added."
        />
      )}
    </Stack>
  );
}
