import { execSync } from "node:child_process";

/**
 * Applies migrations to the dedicated test database (non-destructive).
 * Each test file clears and creates its own fixture rows.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://salon:salon@localhost:5432/salon_test?schema=public";
  if (!/test/i.test(url)) throw new Error(`Refusing to run integration tests against a non-test database: ${url}`);
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
