type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  titleId?: string;
};

export function SectionHeading({ eyebrow, title, description, titleId }: SectionHeadingProps) {
  return (
    <div className="mb-4">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p>
      <h2 id={titleId} className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
