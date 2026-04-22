type AdminModuleHeaderProps = {
  title: string;
  description: string;
  hint?: string;
};

export function AdminModuleHeader({ title, description, hint }: AdminModuleHeaderProps) {
  return (
    <header className="rounded-3xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      {hint ? <p className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600">{hint}</p> : null}
    </header>
  );
}
