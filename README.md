# Salon de Choix — website & online booking

Website and booking system for a combined barbershop and beauty salon.
Next.js 15 · TypeScript · Tailwind CSS · PostgreSQL + Prisma · Docker.

> Work in progress. Done so far: database + seed, slot engine + tests.
> Next: booking flow → public pages → admin panel → e-mails.

## Run everything with Docker

```bash
cp .env.example .env          # adjust passwords
docker compose up --build
```

This starts three services:

| Service   | What it does |
|-----------|--------------|
| `db`      | PostgreSQL 16 (data persisted in the `pgdata` volume) |
| `migrate` | Applies database migrations and runs the seed, then exits. The seed is idempotent: it never overwrites changes made in the admin panel. |
| `app`     | The website on http://localhost:3000 |

## Local development

Requirements: Node.js 22, Docker (or a local PostgreSQL 16).

```bash
cp .env.example .env
docker compose up -d db       # only the database
npm install
npm run db:migrate            # apply migrations
npm run db:seed               # 4 employees, services, options, hours, accounts
npm run dev                   # http://localhost:3000
```

### Seeded accounts

| E-mail | Role |
|--------|------|
| owner@salondechoix.dk | Owner (full access) |
| sofie@ / mads@ / emma@ / ida@salondechoix.dk | Staff |

Password: value of `SEED_OWNER_PASSWORD` / `SEED_STAFF_PASSWORD` (default `changeme123`). **Change them before going live.**

## Tests

```bash
npm test                      # unit tests for the slot engine (no database needed)
npm run test:integration      # booking + concurrency tests against a real database
```

Integration tests use `TEST_DATABASE_URL` (default
`postgresql://salon:salon@localhost:5432/salon_test`). Create that database once:

```bash
docker compose exec db createdb -U salon salon_test
```

## How availability works

The slot engine lives in `src/lib/scheduling/` and is pure TypeScript (no
database), so it's fully unit tested. For each employee and day:

1. Start from the weekly working hours (stored as local wall-clock times).
2. Subtract breaks, blocked time (holidays, sick days, private, salon closed) and existing bookings, including their buffer time.
3. Offer start times on a 15-minute grid where the option's full duration **plus buffer** fits.
4. Drop times in the past, within the minimum notice, or more than 8 weeks ahead.

"No preference" is the union over all qualified employees. On confirm, the booking goes to the
free employee with the fewest bookings that day.

Double bookings are prevented twice over:

- `createBooking()` re-checks availability inside a `SERIALIZABLE` transaction and retries on conflict.
- A PostgreSQL exclusion constraint (`Booking_no_overlap`) makes it impossible to store two overlapping confirmed bookings for the same employee.

All instants are stored in UTC and shown in `Europe/Copenhagen`.
