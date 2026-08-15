import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.AUTH_DATABASE_URL ?? process.env.DATABASE_URL,
});