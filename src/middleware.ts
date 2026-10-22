import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Redirects signed-out visitors from /admin/* to the login page.
// Every admin page and server action additionally checks the session itself.
export default NextAuth(authConfig).auth;

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
