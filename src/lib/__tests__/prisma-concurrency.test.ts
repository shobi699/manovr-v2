import { describe, it, expect } from "vitest";
import path from "path";
import { PrismaClient } from "@prisma/client";

describe("Prisma SQLite concurrency settings", () => {
  it("supports PRAGMA busy_timeout and WAL mode configuration", async () => {
    const dbPath = path.resolve(process.cwd(), "prisma/dev.db");
    const testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${dbPath.replace(/\\/g, "/")}`,
        },
      },
    });

    const count = await testPrisma.personnel.count();
    expect(count).toBeGreaterThanOrEqual(0);

    // بررسی اعمال PRAGMA busy_timeout
    await testPrisma.$queryRawUnsafe("PRAGMA busy_timeout = 30000;");
    const timeoutResult = (await testPrisma.$queryRawUnsafe("PRAGMA busy_timeout;")) as Array<{ timeout: bigint }>;
    expect(Number(timeoutResult[0]?.timeout)).toBe(30000);

    // بررسی اعمال PRAGMA journal_mode = WAL
    const journalResult = (await testPrisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;")) as Array<{ journal_mode: string }>;
    expect(journalResult[0]?.journal_mode?.toLowerCase()).toBe("wal");

    await testPrisma.$disconnect();
  });
});
