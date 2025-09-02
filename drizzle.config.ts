import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/database/schema.ts',
  out: './lib/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/cryptotrader',
  },
  verbose: true,
  strict: true,
} satisfies Config;
