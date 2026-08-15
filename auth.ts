import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import PostgresAdapter from "@auth/pg-adapter";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.AUTH_DATABASE_URL ?? process.env.DATABASE_URL,
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: PostgresAdapter(pool),
  session: { strategy: "database" },
  providers: [GitHub],
});