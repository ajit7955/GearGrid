
import pg from "pg";
import "dotenv/config";
const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing. Add your Neon connection string to server/.env");
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});
pool.on("error", (err) => console.error("Unexpected PostgreSQL pool error:", err));
