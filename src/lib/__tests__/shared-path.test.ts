import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Shared network database configuration and URL formatting", () => {
  it("verifies that manovr-config.json exists and contains correct sharedDataPath", () => {
    const configPath = path.join(process.cwd(), "manovr-config.json");
    expect(fs.existsSync(configPath)).toBe(true);

    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    expect(config.sharedDataPath).toBe("\\\\srvdfs01\\Line1\\Depo\\data");
    expect(config.fallbackToLocal).toBe(true);
  });

  it("formats Windows UNC paths correctly into Prisma SQLite URLs", () => {
    function formatDatabaseUrl(rawPath: string): string {
      const normalized = rawPath.replace(/\\/g, "/");
      return `file:${normalized}`;
    }

    const uncPath = "\\\\srvdfs01\\Line1\\Depo\\data\\database\\dev.db";
    const formattedUrl = formatDatabaseUrl(uncPath);

    // باید به فرمت file://srvdfs01/Line1/Depo/data/database/dev.db تبدیل شود
    expect(formattedUrl).toBe("file://srvdfs01/Line1/Depo/data/database/dev.db");
    expect(formattedUrl.startsWith("file://")).toBe(true);
    expect(formattedUrl.includes("\\")).toBe(false);
  });

  it("formats mapped drive paths correctly into Prisma SQLite URLs", () => {
    function formatDatabaseUrl(rawPath: string): string {
      const normalized = rawPath.replace(/\\/g, "/");
      return `file:${normalized}`;
    }

    const mappedPath = "Z:\\data\\database\\dev.db";
    const formattedUrl = formatDatabaseUrl(mappedPath);

    expect(formattedUrl).toBe("file:Z:/data/database/dev.db");
    expect(formattedUrl.startsWith("file:Z:/")).toBe(true);
    expect(formattedUrl.includes("\\")).toBe(false);
  });
});
