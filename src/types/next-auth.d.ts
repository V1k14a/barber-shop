import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "OWNER" | "STAFF";
    employeeId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      role: "OWNER" | "STAFF";
      employeeId: string | null;
    } & DefaultSession["user"];
  }
}
