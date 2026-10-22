import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendDueReminders } from "@/lib/email/reminders";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Called hourly by the `cron` container: `Authorization: Bearer $CRON_SECRET`. */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return jsonError(401, "Unauthorized");
  }
  return NextResponse.json(await sendDueReminders(prisma));
}

export const GET = handle;
export const POST = handle;
