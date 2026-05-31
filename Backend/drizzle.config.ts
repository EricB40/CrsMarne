import { defineConfig } from 'drizzle-kit';
import "dotenv/config";

// Provide a minimal declaration so TypeScript recognizes `process` in this config file
declare const process: { env: { DATABASE_URL?: string } };

/// <reference types="node" />

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});