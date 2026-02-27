import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function buildPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  if (databaseUrl.startsWith("prisma://") || databaseUrl.startsWith("prisma+postgres://")) {
    return new PrismaClient({ accelerateUrl: databaseUrl });
  }

  if (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")) {
    const url = new URL(databaseUrl);
    const apiKey = url.searchParams.get("api_key") ?? url.password;

    if (!apiKey) {
      throw new Error("DATABASE_URL must include an api_key for Prisma Accelerate");
    }

    url.protocol = "prisma+postgres:";
    url.username = "";
    url.password = "";
    url.searchParams.set("api_key", apiKey);

    return new PrismaClient({ accelerateUrl: url.toString() });
  }

  throw new Error("Unsupported DATABASE_URL protocol");
}

export function getDb(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const client = buildPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}
