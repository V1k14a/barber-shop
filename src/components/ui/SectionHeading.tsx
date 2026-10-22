export function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-light tracking-tight sm:text-4xl">{title}</h2>
      {children && <div className="mt-4 text-muted">{children}</div>}
    </div>
  );
}
