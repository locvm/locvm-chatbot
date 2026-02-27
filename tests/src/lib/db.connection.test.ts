import { getDb } from "@/src/lib/db";

const runConnectionTest = process.env.RUN_DB_CONNECTION_TEST === "1";
const connectionTest = runConnectionTest ? test : test.skip;

connectionTest(
  "connects to PostgreSQL with Prisma adapter and can run a simple query",
  async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }

    const db = getDb();
    const result = await db.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(Number(result[0]?.ok)).toBe(1);

    await db.$disconnect();
  },
  30_000
);
