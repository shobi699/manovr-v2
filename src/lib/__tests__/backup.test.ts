import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import fs from "fs";
import { getActiveDbPath, getBackupBaseDir, resolveBackupPath } from "@/lib/backup";

const ORIGINAL_DB_URL = process.env.DATABASE_URL;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  if (ORIGINAL_DB_URL !== undefined) {
    process.env.DATABASE_URL = ORIGINAL_DB_URL;
  } else {
    delete process.env.DATABASE_URL;
  }
});

describe("backup module path helpers", () => {
  describe("getActiveDbPath", () => {
    it("defaults to prisma/dev.db when DATABASE_URL is not set", () => {
      delete process.env.DATABASE_URL;
      const dbPath = getActiveDbPath();
      expect(dbPath).toBe(path.join(process.cwd(), "prisma", "dev.db"));
    });

    it("resolves relative file: path against cwd", () => {
      process.env.DATABASE_URL = "file:./custom/dev.db";
      const dbPath = getActiveDbPath();
      expect(dbPath).toBe(path.resolve(process.cwd(), "./custom/dev.db"));
    });

    it("preserves absolute file: path", () => {
      const absoluteTarget = path.resolve(process.cwd(), "portable-data", "database", "dev.db");
      process.env.DATABASE_URL = `file:${absoluteTarget}`;
      const dbPath = getActiveDbPath();
      expect(dbPath).toBe(absoluteTarget);
    });

    it("preserves UNC network share file: path", () => {
      const uncTarget = "\\\\server\\share\\data\\database\\dev.db";
      process.env.DATABASE_URL = `file:${uncTarget}`;
      const dbPath = getActiveDbPath();
      expect(dbPath).toBe(uncTarget);
    });
  });

  describe("getBackupBaseDir", () => {
    it("returns sibling backups directory when db is inside a database folder", () => {
      const portableDb = path.resolve(process.cwd(), "my-data", "database", "dev.db");
      process.env.DATABASE_URL = `file:${portableDb}`;
      const backupDir = getBackupBaseDir();
      expect(backupDir).toBe(path.resolve(process.cwd(), "my-data", "backups"));
    });

    it("returns cwd/backups for default prisma path", () => {
      delete process.env.DATABASE_URL;
      const backupDir = getBackupBaseDir();
      expect(backupDir).toBe(path.join(process.cwd(), "backups"));
    });
  });

  describe("resolveBackupPath", () => {
    it("returns null for null, undefined, or empty path", () => {
      expect(resolveBackupPath(null, "db")).toBeNull();
      expect(resolveBackupPath(undefined, "app")).toBeNull();
      expect(resolveBackupPath("", "db")).toBeNull();
    });

    it("returns storedPath if file physically exists at storedPath", () => {
      vi.spyOn(fs, "existsSync").mockImplementation((p) => {
        return p === "D:\\custom\\backup.db";
      });
      const result = resolveBackupPath("D:\\custom\\backup.db", "db");
      expect(result).toBe("D:\\custom\\backup.db");
    });

    it("falls back to base backup directory when storedPath does not exist but local file does", () => {
      const expectedFallback = path.join(getBackupBaseDir(), "db", "backup.db");
      vi.spyOn(fs, "existsSync").mockImplementation((p) => {
        return p === expectedFallback;
      });
      const result = resolveBackupPath("C:\\old_machine\\backup.db", "db");
      expect(result).toBe(expectedFallback);
    });

    it("returns null if neither storedPath nor fallback exists", () => {
      vi.spyOn(fs, "existsSync").mockReturnValue(false);
      const result = resolveBackupPath("C:\\nonexistent\\backup.db", "db");
      expect(result).toBeNull();
    });
  });
});
