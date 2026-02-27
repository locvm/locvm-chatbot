import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

type ConnectionMode = "auto" | "accelerate";

function getConnectionMode(): ConnectionMode {
  const raw = (process.env.PRISMA_CONNECTION_MODE ?? "auto").toLowerCase();
  if (raw === "accelerate" || raw === "auto") {
    return raw;
  }

  return "auto";
}

function buildPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;
  const connectionMode = getConnectionMode();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  if (databaseUrl.startsWith("prisma://") || databaseUrl.startsWith("prisma+postgres://")) {
    return new PrismaClient({ accelerateUrl: databaseUrl });
  }

  if (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")) {
    const url = new URL(databaseUrl);
    const apiKey = url.searchParams.get("api_key") ?? url.password;

    if (!apiKey && connectionMode === "accelerate") {
      throw new Error(
        "DATABASE_URL must include an api_key for Prisma Accelerate. Example: prisma+postgres://...?...&api_key=..."
      );
    }

    if (!apiKey && connectionMode === "auto") {
      throw new Error(
        "DATABASE_URL is missing an api_key and this generated Prisma client requires Accelerate mode."
      );
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
