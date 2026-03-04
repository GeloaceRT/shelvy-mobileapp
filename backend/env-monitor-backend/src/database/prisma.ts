import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;
try {
  prisma = new PrismaClient();
} catch (e) {
  console.warn('[prisma] PrismaClient unavailable (serverless?):', (e as any)?.message);
  prisma = null as any;
}

export default prisma;