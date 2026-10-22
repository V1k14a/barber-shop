/** Employee photo, or initials on a sand circle when no photo is set. */
export function Avatar({ name, photoUrl, size = 48 }: { name: string; photoUrl?: string | null; size?: number }) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-sand tracking-widest"
      style={{ width: size, height: size, fontSize: size / 3.5 }}
    >
      {initials}
    </span>
  );
}
