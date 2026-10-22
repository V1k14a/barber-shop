import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

// bcrypt hash of a random string, used when the e-mail is unknown.
const DUMMY_HASH = "$2b$12$B58s740LDohq55x7dC5j6O3GE31xCTU/HoOr2ojdtsAxl9tag6vym";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        // Slow down password guessing: 10 attempts per 15 minutes per account.
        if (!rateLimit(`login:${email}`, 10, 15 * 60_000)) return null;

        const user = await prisma.adminUser.findUnique({ where: { email } });
        // Compare against a dummy hash when the user doesn't exist, so timing doesn't reveal valid e-mails.
        const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !ok) return null;
        return { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId };
      },
    }),
  ],
});
