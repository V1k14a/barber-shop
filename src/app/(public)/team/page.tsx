import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { getTeam } from "@/lib/salon";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const team = await getTeam();

  return (
    <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 md:pt-16">
      <p className="eyebrow">The team</p>
      <h1 className="mt-2 text-4xl font-light tracking-tight sm:text-5xl">Meet the team</h1>
      <p className="mt-4 max-w-xl text-muted">Hairdresser, barber and nail technicians — pick your favourite when you book.</p>

      <ul className="mt-12 grid gap-6 sm:grid-cols-2">
        {team.map((e) => {
          const services = e.services.map((s) => s.service).sort((a, b) => a.sortOrder - b.sortOrder);
          return (
            <li key={e.id} className="flex flex-col border border-line bg-white p-6">
              <div className="flex items-center gap-5">
                <Avatar name={e.name} photoUrl={e.photoUrl} size={88} />
                <div>
                  <h2 className="text-2xl font-light">{e.name}</h2>
                  <p className="text-muted">{e.title}</p>
                </div>
              </div>
              {e.bio && <p className="mt-5 flex-1">{e.bio}</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                {services.map((s) => (
                  <Link
                    key={s.id}
                    href={`/booking?service=${s.slug}&employee=${e.id}`}
                    className="border border-line px-3 py-2 text-sm hover:border-ink"
                  >
                    Book {s.name.toLowerCase()} →
                  </Link>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
