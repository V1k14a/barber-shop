# Salon de Choix — website & online booking

Website and booking system for a combined barbershop and beauty salon: public website,
online booking with live availability, staff admin panel and e-mail notifications.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL 16 + Prisma ·
Auth.js · Nodemailer · Vitest · Docker.

---

## Quick start (Docker)

```bash
cp .env.example .env
# Edit .env: set AUTH_SECRET and CRON_SECRET (openssl rand -base64 32), APP_URL, SMTP settings
docker compose up --build -d
```

Open http://localhost:3000 — staff login at http://localhost:3000/admin.

| Service   | What it does |
|-----------|--------------|
| `db`      | PostgreSQL 16, data in the `pgdata` volume |
| `migrate` | Applies migrations and runs the seed, then exits. The seed is idempotent and never overwrites changes made in the admin panel. |
| `app`     | The website (port 3000) |
| `cron`    | Calls the reminder endpoint once an hour |

Update to a new version: `git pull && docker compose up --build -d`.

### Seeded logins

| E-mail | Role |
|--------|------|
| owner@salondechoix.dk | Owner — everything |
| sofie@, mads@, emma@, ida@salondechoix.dk | Staff |

Passwords: `SEED_OWNER_PASSWORD` / `SEED_STAFF_PASSWORD` from `.env` (default `changeme123`).
**Change them after the first login** (*More → My account*), or set strong values before the first start.

### Going live

- Put the app behind HTTPS, e.g. [Caddy](https://caddyserver.com) (`reverse_proxy localhost:3000`) or nginx.
- Set `APP_URL` to the public address (used in e-mail links).
- Configure SMTP (any provider: your web host, Brevo, Postmark, Amazon SES …). Without `SMTP_HOST`
  e-mails are only written to the app log.
- Remove `ports: - "5432:5432"` from `db` in `docker-compose.yml` if the database shouldn't be reachable from outside.
- Back up the database regularly, e.g. `docker compose exec db pg_dump -U salon salon > backup.sql`.

---

## Local development

Requirements: Node.js 22 and Docker (or a local PostgreSQL 16).

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run db:migrate     # apply migrations
npm run db:seed        # demo data
npm run dev            # http://localhost:3000
```

| Script | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit tests (slot engine, e-mail templates) — no database needed |
| `npm run test:integration` | Booking, concurrency, cancellation and reminder tests against a real database |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma |

Integration tests use `TEST_DATABASE_URL` (default `postgresql://salon:salon@localhost:5432/salon_test`).
Create it once: `docker compose exec db createdb -U salon salon_test`.

---

## Features

**Public website** — Home, Services & prices (from the database), Team, Contact (map, opening hours,
click-to-call) and Booking. Mobile-first. Photos are placeholders (`PhotoPlaceholder` component,
employee photo URLs can be set in the admin panel).

**Booking flow** — service → option → employee or *No preference* → date (closed or fully booked
days greyed out) → time → name, phone, e-mail → confirmation. Links such as
`/booking?service=mens-haircut&option=…&employee=…` skip steps (used by the Services and Team pages).

**Admin panel** (`/admin`, large buttons, bottom tab bar on phones)

| | Staff | Owner |
|---|:---:|:---:|
| Day / week calendar, filter per employee | ✓ | ✓ |
| Add bookings (phone, walk-in), any free minute | ✓ | ✓ |
| Move, cancel, mark completed / no-show, notes | ✓ | ✓ |
| Block time off (holiday, sick, private) | own | anyone / whole salon |
| Services, options, durations, prices, buffers, who does what | | ✓ |
| Employees, weekly hours & breaks, logins | | ✓ |
| Salon settings & booking rules | | ✓ |

**E-mails** — confirmation (with calendar `.ics` attachment and cancel link), reminder the day before
(from `REMINDER_HOUR`, default 10:00), changed time, cancellation. Customers can cancel online up to
24 hours before (configurable). The cancel link opens a confirmation page — it never cancels on its own,
so link scanners in mail programs can't cancel bookings.

---

## How availability works

The slot engine (`src/lib/scheduling/`) is pure TypeScript with no database access, so it is fully unit tested.
For each employee and day:

1. Start from the weekly working hours (stored as local wall-clock times so 09:00 stays 09:00 across daylight-saving changes).
2. Subtract breaks, blocked time and existing bookings including their buffer time.
3. Offer start times on the slot grid (default every 15 min) where the option's full duration **plus buffer** fits.
4. Drop times in the past, within the minimum notice (default 60 min) or beyond the horizon (default 8 weeks).

*No preference* is the union over all qualified employees. On confirm, the booking goes to the free
employee with the fewest bookings that day (ties: team order).

**No double bookings** — guaranteed twice:

- `createBooking()` / `moveBooking()` re-check availability inside a `SERIALIZABLE` transaction and retry on conflicts
  (a *No preference* booking can then still land on another free employee).
- A PostgreSQL exclusion constraint (`Booking_no_overlap`) makes it impossible to store two overlapping
  confirmed bookings for the same employee — even from code that bypasses the service.

All instants are stored in UTC and shown in the salon's time zone (`Europe/Copenhagen`).

---

## Project structure

```
prisma/                 schema, migrations (incl. exclusion constraint), seed
src/app/(public)/       website + booking + cancel page
src/app/admin/          login and staff panel (server actions next to each page)
src/app/api/            slots, availability, bookings, admin slots, auth, cron/reminders
src/lib/scheduling/     ★ slot engine (pure, unit tested)
src/lib/booking/        booking service (transactions), errors, notifications
src/lib/email/          SMTP transport, templates, reminders
src/components/         site, booking wizard, admin UI, shared UI
tests/integration/      database tests incl. simultaneous requests
```

## Environment variables

See `.env.example`. Required in production: `DATABASE_URL` (set by compose), `AUTH_SECRET`, `CRON_SECRET`,
`APP_URL`, `SMTP_*`, `MAIL_FROM`.
