import Link from "next/link";

// Placeholder — the full homepage is built in the public pages step.
export default function HomePage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
      <h1 className="text-4xl font-light tracking-tight">Salon de Choix</h1>
      <Link href="/booking" className="mt-8 inline-block bg-ink px-8 py-4 text-paper">
        Book now
      </Link>
    </section>
  );
}
