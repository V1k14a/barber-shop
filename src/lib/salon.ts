import { cache } from "react";
import { prisma } from "@/lib/db";

export interface OpeningHoursLine {
  days: string;
  hours: string;
}

/** Salon settings for rendering (cached per request). */
export const getSalonSettings = cache(async () => {
  const s = await prisma.salonSettings.findUnique({ where: { id: 1 } });
  if (!s) throw new Error("Salon settings missing — run `npm run db:seed`.");
  return { ...s, openingHours: (Array.isArray(s.openingHours) ? s.openingHours : []) as unknown as OpeningHoursLine[] };
});

/** Services with their active options and the employees who perform them. */
export const getServiceCatalog = cache(async () => {
  return prisma.service.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      options: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      employees: {
        where: { employee: { active: true } },
        include: { employee: { select: { id: true, name: true, title: true, photoUrl: true, sortOrder: true } } },
      },
    },
  });
});
