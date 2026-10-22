/**
 * Seed script — idempotent. Safe to run repeatedly: it upserts the salon
 * settings, services, options, employees and admin accounts, and only creates
 * working hours / breaks for an employee that has none yet (so edits made in
 * the admin panel are never overwritten).
 *
 * Run: npm run db:seed
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const h = (hhmm: string) => {
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
};
const dkk = (kr: number) => kr * 100;

type OptionSeed = { id: string; name: string; durationMin: number; price: number; bufferMin?: number };

const services: { slug: string; name: string; description: string; options: OptionSeed[] }[] = [
  {
    slug: "womens-haircut",
    name: "Women's haircut",
    description: "Consultation, wash, cut and finish tailored to you.",
    options: [
      { id: "opt_w_cut_blow", name: "Cut & blow-dry", durationMin: 60, price: 595 },
      { id: "opt_w_short", name: "Short haircut", durationMin: 45, price: 495 },
      { id: "opt_w_long", name: "Long hair cut & style", durationMin: 75, price: 695 },
      { id: "opt_w_fringe", name: "Fringe trim", durationMin: 15, price: 150 },
    ],
  },
  {
    slug: "mens-haircut",
    name: "Men's haircut",
    description: "Classic and modern cuts, beard grooming and clean finishes.",
    options: [
      { id: "opt_m_cut", name: "Haircut", durationMin: 30, price: 350 },
      { id: "opt_m_beard", name: "Beard trim", durationMin: 20, price: 200 },
      { id: "opt_m_cut_beard", name: "Haircut + beard", durationMin: 45, price: 495 },
      { id: "opt_m_buzz", name: "Buzz cut", durationMin: 20, price: 250 },
    ],
  },
  {
    slug: "manicure",
    name: "Manicure",
    description: "Nail care, shaping and polish for well-groomed hands.",
    options: [
      { id: "opt_mani_classic", name: "Classic manicure", durationMin: 45, price: 375, bufferMin: 10 },
      { id: "opt_mani_gel", name: "Gel polish", durationMin: 60, price: 450, bufferMin: 10 },
      { id: "opt_mani_gel_refill", name: "Gel removal + new gel", durationMin: 75, price: 525, bufferMin: 15 },
      { id: "opt_mani_polish", name: "Polish only", durationMin: 20, price: 200, bufferMin: 5 },
    ],
  },
  {
    slug: "pedicure",
    name: "Pedicure",
    description: "Foot bath, nail and cuticle care, and polish.",
    options: [
      { id: "opt_pedi_classic", name: "Classic pedicure", durationMin: 60, price: 495, bufferMin: 10 },
      { id: "opt_pedi_spa", name: "Spa pedicure", durationMin: 75, price: 595, bufferMin: 15 },
      { id: "opt_pedi_gel", name: "Pedicure + gel polish", durationMin: 90, price: 675, bufferMin: 15 },
    ],
  },
];

type Shift = { weekday: number; start: string; end: string };
const weekdays = (start: string, end: string, days = [1, 2, 3, 4, 5]): Shift[] =>
  days.map((weekday) => ({ weekday, start, end }));
const lunch = (days = [1, 2, 3, 4, 5]) => days.map((weekday) => ({ weekday, start: "12:00", end: "12:30" }));

const employees = [
  {
    id: "emp_sofie",
    name: "Sofie Larsen",
    title: "Hairdresser",
    bio: "Fifteen years behind the chair. Loves precision bobs, soft layers and a good fade.",
    services: ["womens-haircut", "mens-haircut"],
    email: "sofie@salondechoix.dk",
    hours: [...weekdays("09:00", "17:00", [1, 2, 3]), ...weekdays("11:00", "19:00", [4, 5]), { weekday: 6, start: "09:00", end: "14:00" }],
    breaks: [...lunch([1, 2, 3]), { weekday: 4, start: "14:00", end: "14:30" }, { weekday: 5, start: "14:00", end: "14:30" }],
  },
  {
    id: "emp_mads",
    name: "Mads Holm",
    title: "Barber",
    bio: "Classic barbering, skin fades and hot-towel beard trims.",
    services: ["mens-haircut"],
    email: "mads@salondechoix.dk",
    hours: [...weekdays("10:00", "18:00", [2, 3, 4, 5]), { weekday: 6, start: "09:00", end: "15:00" }],
    breaks: lunch([2, 3, 4, 5]),
  },
  {
    id: "emp_emma",
    name: "Emma Nielsen",
    title: "Nail technician",
    bio: "Gel specialist with an eye for clean, minimal nail art.",
    services: ["manicure", "pedicure"],
    email: "emma@salondechoix.dk",
    hours: weekdays("09:00", "17:00"),
    breaks: lunch(),
  },
  {
    id: "emp_ida",
    name: "Ida Jensen",
    title: "Nail technician",
    bio: "Relaxing spa pedicures and long-lasting manicures.",
    services: ["manicure", "pedicure"],
    email: "ida@salondechoix.dk",
    hours: [...weekdays("10:00", "18:00", [2, 3, 4, 5]), { weekday: 6, start: "10:00", end: "15:00" }],
    breaks: lunch([2, 3, 4, 5]),
  },
];

async function main() {
  await prisma.salonSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Salon de Choix",
      tagline: "Hair, beard & nails — in the heart of Copenhagen",
      addressLine: "Eksempelgade 12",
      postalCode: "1000",
      city: "København K",
      phone: "+45 12 34 56 78",
      email: "hello@salondechoix.dk",
      timezone: "Europe/Copenhagen",
      openingHours: [
        { days: "Monday – Wednesday", hours: "09:00 – 18:00" },
        { days: "Thursday – Friday", hours: "09:00 – 19:00" },
        { days: "Saturday", hours: "09:00 – 15:00" },
        { days: "Sunday", hours: "Closed" },
      ],
    },
  });

  const serviceIdBySlug: Record<string, string> = {};
  for (const [i, s] of services.entries()) {
    const service = await prisma.service.upsert({
      where: { slug: s.slug },
      update: {},
      create: { slug: s.slug, name: s.name, description: s.description, sortOrder: i },
    });
    serviceIdBySlug[s.slug] = service.id;
    for (const [j, o] of s.options.entries()) {
      await prisma.serviceOption.upsert({
        where: { id: o.id },
        update: {},
        create: {
          id: o.id,
          serviceId: service.id,
          name: o.name,
          durationMin: o.durationMin,
          priceOre: dkk(o.price),
          bufferMin: o.bufferMin ?? 0,
          sortOrder: j,
        },
      });
    }
  }

  const defaultStaffPassword = process.env.SEED_STAFF_PASSWORD ?? "changeme123";
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "changeme123";

  for (const [i, e] of employees.entries()) {
    await prisma.employee.upsert({
      where: { id: e.id },
      update: {},
      create: { id: e.id, name: e.name, title: e.title, bio: e.bio, sortOrder: i },
    });

    for (const slug of e.services) {
      const serviceId = serviceIdBySlug[slug];
      await prisma.employeeService.upsert({
        where: { employeeId_serviceId: { employeeId: e.id, serviceId } },
        update: {},
        create: { employeeId: e.id, serviceId },
      });
    }

    if ((await prisma.workingHours.count({ where: { employeeId: e.id } })) === 0) {
      await prisma.workingHours.createMany({
        data: e.hours.map((s) => ({ employeeId: e.id, weekday: s.weekday, startMin: h(s.start), endMin: h(s.end) })),
      });
    }
    if ((await prisma.break.count({ where: { employeeId: e.id } })) === 0) {
      await prisma.break.createMany({
        data: e.breaks.map((s) => ({ employeeId: e.id, weekday: s.weekday, startMin: h(s.start), endMin: h(s.end), label: "Lunch" })),
      });
    }

    await prisma.adminUser.upsert({
      where: { email: e.email },
      update: {},
      create: {
        email: e.email,
        passwordHash: await bcrypt.hash(defaultStaffPassword, 12),
        role: Role.STAFF,
        employeeId: e.id,
      },
    });
  }

  await prisma.adminUser.upsert({
    where: { email: "owner@salondechoix.dk" },
    update: {},
    create: {
      email: "owner@salondechoix.dk",
      passwordHash: await bcrypt.hash(ownerPassword, 12),
      role: Role.OWNER,
    },
  });

  console.log("Seed complete: 4 services, 15 options, 4 employees, 5 admin accounts.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
