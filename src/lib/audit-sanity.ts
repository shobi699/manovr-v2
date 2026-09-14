import { prisma } from "./prisma";

export interface DatabaseSanityResult {
  connected: boolean;
  journalMode: string;
  busyTimeout: number;
  cacheSize: number;
  tablesAccessible: {
    users: boolean;
    lines: boolean;
    trains: boolean;
    manovrs: boolean;
  };
  latencyMs: number;
  error?: string;
}

/**
 * Validates database connectivity, SQLite pragmas, and basic table accessibility.
 */
export async function checkDatabaseSanity(): Promise<DatabaseSanityResult> {
  const start = Date.now();
  try {
    const journalResult = (await prisma.$queryRawUnsafe(
      "PRAGMA journal_mode;"
    )) as Array<{ journal_mode?: string }>;
    const timeoutResult = (await prisma.$queryRawUnsafe(
      "PRAGMA busy_timeout;"
    )) as Array<{ timeout?: number }>;
    const cacheResult = (await prisma.$queryRawUnsafe(
      "PRAGMA cache_size;"
    )) as Array<{ cache_size?: number }>;

    const journalMode = journalResult?.[0]?.journal_mode || "UNKNOWN";
    const busyTimeout = timeoutResult?.[0]?.timeout ?? 0;
    const cacheSize = cacheResult?.[0]?.cache_size ?? 0;

    // Check table access
    const [personnelCount, lineCount, trainCount, manovrCount] = await Promise.all([
      prisma.personnel.count().then(() => true).catch(() => false),
      prisma.line.count().then(() => true).catch(() => false),
      prisma.train.count().then(() => true).catch(() => false),
      prisma.manovr.count().then(() => true).catch(() => false),
    ]);

    const latencyMs = Date.now() - start;

    return {
      connected: true,
      journalMode,
      busyTimeout,
      cacheSize,
      tablesAccessible: {
        users: personnelCount,
        lines: lineCount,
        trains: trainCount,
        manovrs: manovrCount,
      },
      latencyMs,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      journalMode: "ERROR",
      busyTimeout: 0,
      cacheSize: 0,
      tablesAccessible: {
        users: false,
        lines: false,
        trains: false,
        manovrs: false,
      },
      latencyMs: Date.now() - start,
      error: errorMsg,
    };
  }
}
