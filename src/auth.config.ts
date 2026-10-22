import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe part of the auth config (used by middleware). The credentials
 * provider, which needs the database and bcrypt, is added in src/auth.ts.
 */
export const authConfig = {
  pages: { signIn: "/admin/login" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname === "/admin/login") return true;
      if (pathname.startsWith("/admin")) return !!auth?.user;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.employeeId = user.employeeId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as "OWNER" | "STAFF";
      session.user.employeeId = (token.employeeId as string | null) ?? null;
      return session;
    },
  },
} satisfies NextAuthConfig;
