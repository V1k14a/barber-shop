/**
 * Neutral stand-in for photography. Replace with <Image src="/images/…" />
 * once the salon's own photos are available.
 */
export function PhotoPlaceholder({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={`${label} (photo coming soon)`}
      className={`relative flex items-end overflow-hidden bg-sand ${className}`}
    >
      <svg aria-hidden className="absolute inset-0 h-full w-full text-line" preserveAspectRatio="none" viewBox="0 0 100 100">
        <path d="M0 100 L40 45 L60 70 L75 55 L100 85 L100 100 Z" fill="currentColor" opacity="0.6" />
        <circle cx="78" cy="25" r="8" fill="currentColor" opacity="0.6" />
      </svg>
      <span className="relative m-4 text-xs tracking-[0.2em] text-muted uppercase">{label}</span>
    </div>
  );
}
