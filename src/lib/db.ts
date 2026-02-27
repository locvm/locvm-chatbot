// TODO: Initialize PrismaClient with a driver adapter in next phase.
// Prisma 7 requires a driver adapter (e.g. @prisma/adapter-pg with pg).
// See: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/driver-adapters
import type { PrismaClient } from "../../app/generated/prisma/client";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

// Placeholder singleton – replace with adapter-based instantiation in next phase
export const db: PrismaClient = globalForPrisma.prisma as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
