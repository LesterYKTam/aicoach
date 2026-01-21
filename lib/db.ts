import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://aicoach:aicoach@localhost:5432/aicoach';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});
