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
    <Card tone="hero" className="hairline px-2.5 py-1 sm:px-4 sm:py-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-[11px] font-semibold text-white shadow-soft sm:h-12 sm:w-12 sm:rounded-[20px] sm:text-sm">
          {getInitials(user.name, user.email)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <StatusPill tone="success" className="px-2 py-0.5 text-[8px] tracking-[0.15em] sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.18em]">
              Bugün
            </StatusPill>
            {firstName ? <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-xs sm:tracking-[0.16em]">{firstName}</p> : null}
          </div>
          <p className="mt-1 hidden truncate text-sm font-semibold text-slate-950 sm:mt-2 sm:block sm:text-base">{formatDateInAppTimeZone(now)}</p>
        </div>
      </div>
    </Card>
  );
}
