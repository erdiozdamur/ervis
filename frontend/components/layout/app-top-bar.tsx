import { Card } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { formatDateInAppTimeZone } from '@/lib/date/istanbul';

type AppTopBarProps = {
  user: {
    name?: string | null;
    email?: string | null;
  };
};

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || 'U';
  return source.slice(0, 2).toUpperCase();
}

function getFirstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] ?? null;
}

export function AppTopBar({ user }: AppTopBarProps) {
  const now = new Date();
  const firstName = getFirstName(user.name);

  return (
    <Card tone="hero" className="hairline px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-slate-950 text-sm font-semibold text-white shadow-soft">
          {getInitials(user.name, user.email)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusPill tone="success" className="px-2.5 py-1 text-[10px] tracking-[0.18em]">
              Bugün
            </StatusPill>
            {firstName ? <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{firstName}</p> : null}
          </div>
          <p className="mt-2 truncate text-base font-semibold text-slate-950">{formatDateInAppTimeZone(now)}</p>
        </div>
      </div>
    </Card>
  );
}
