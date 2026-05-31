import * as schema from './schema';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import "dotenv/config";

// Create a connection pool to the PostgreSQL database using the connection string from environment variables
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL})
// Initialize the Drizzle ORM instance with the connection pool and the database schema
export const db = drizzle(pool, { schema: schema });