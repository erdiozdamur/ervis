import { Card } from '@/components/ui/card';
import { formatDateInAppTimeZone } from '@/lib/date/istanbul';

type AppTopBarProps = {
  user: {
    name?: string | null;
    email?: string | null;
  };
};

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || 'U';
  const parts = source
    .split(/[\s@._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function getDisplayName(name?: string | null, email?: string | null) {
  return name?.trim() || email?.trim() || null;
}

export function AppTopBar({ user }: AppTopBarProps) {
  const now = new Date();
  const displayName = getDisplayName(user.name, user.email);
  const formattedDate = formatDateInAppTimeZone(now);

  return (
    <Card tone="hero" className="hairline px-2.5 py-1 sm:px-4 sm:py-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-[11px] font-semibold text-white shadow-soft sm:h-12 sm:w-12 sm:rounded-[20px] sm:text-sm">
          {getInitials(user.name, user.email)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-950 sm:hidden">{formattedDate}</p>
          <div className="hidden min-w-0 items-center gap-3 sm:flex">
            {displayName ? <p className="truncate text-sm font-semibold text-slate-950 sm:text-base">{displayName}</p> : null}
            <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{formattedDate}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
