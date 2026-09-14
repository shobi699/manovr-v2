import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { parseSemVer, compareSemVer, checkForUpdates } from "../auto-updater/version-checker";
import { updateManifestSchema, UpdateManifest } from "../auto-updater/types";
import { calculateFileSha256 } from "../auto-updater/patch-engine";

describe("Auto-Updater Core Engine & Version Verification", () => {
  describe("SemVer Parsing & Comparison", () => {
    it("correctly parses standard SemVer strings", () => {
      expect(parseSemVer("1.2.3")).toEqual([1, 2, 3]);
      expect(parseSemVer("v3.10.45")).toEqual([3, 10, 45]);
      expect(parseSemVer("0.1.0-beta.1")).toEqual([0, 1, 0]);
      expect(parseSemVer("invalid")).toEqual([0, 0, 0]);
    });

    it("correctly compares versions and detects newer releases", () => {
      expect(compareSemVer("3.2.0", "3.1.9")).toBe(1);
      expect(compareSemVer("4.0.0", "3.99.99")).toBe(1);
      expect(compareSemVer("3.1.1", "3.1.2")).toBe(-1);
      expect(compareSemVer("2.5.0", "2.5.0")).toBe(0);
      expect(compareSemVer("v1.5.0", "1.5.0")).toBe(0);
    });
  });

  describe("Manifest Schema Validation (Zod)", () => {
    it("validates a compliant version.json manifest", () => {
      const validData: UpdateManifest = {
        version: "3.2.0",
        releaseDate: "2026-09-15T08:30:00Z",
        releaseDateJalali: "۱۴۰۵/۰۶/۲۵",
        minSupportedVersion: "3.0.0",
        packageType: "patch",
        packageFile: "patches/patch-3.2.0.zip",
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        fileSizeBytes: 1425840,
        mandatory: false,
        targetPlatform: "win-x64",
        changelog: {
          highlights: ["بهبود کارایی"],
          features: ["ویژگی جدید"],
          fixes: ["رفع باگ"],
        },
      };

      const result = updateManifestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("rejects manifest with invalid SHA-256 or version format", () => {
      const invalidData = {
        version: "not-a-version",
        sha256: "short-hash",
      };

      const result = updateManifestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues || (result.error as any).errors || [];
        expect(issues.some((e: any) => e.path.includes("version"))).toBe(true);
        expect(issues.some((e: any) => e.path.includes("sha256"))).toBe(true);
      }
    });
  });

  describe("File Integrity & SHA-256 Verification", () => {
    it("calculates exact SHA-256 hash of a file stream", async () => {
      const testFilePath = path.join(process.cwd(), ".test_hash_sample.tmp");
      const sampleContent = "Manovr Railway System Non-Installer Update Package Content";
      fs.writeFileSync(testFilePath, sampleContent);

      const expectedHash = crypto.createHash("sha256").update(sampleContent).digest("hex").toLowerCase();
      const calculated = await calculateFileSha256(testFilePath);

      expect(calculated).toBe(expectedHash);

      // پاکسازی فایل تستی
      try { fs.unlinkSync(testFilePath); } catch {}
    });
  });

  describe("Update Detection Against Local Stored Manifest", () => {
    it("reads manifest and flags update when manifest version > current version", async () => {
      const testDir = path.join(process.cwd(), ".test_update_dir");
      fs.mkdirSync(testDir, { recursive: true });

      const manifestContent: UpdateManifest = {
        version: "99.0.0",
        releaseDate: "2026-09-11T10:00:00Z",
        releaseDateJalali: "۱۴۰۵/۰۶/۲۱",
        minSupportedVersion: "0.1.0",
        packageType: "patch",
        packageFile: "patch.zip",
        sha256: "a".repeat(64),
        fileSizeBytes: 1024,
        mandatory: false,
        targetPlatform: "win-x64",
        changelog: { highlights: [], features: [], fixes: [] },
      };

      fs.writeFileSync(path.join(testDir, "version.json"), JSON.stringify(manifestContent));

      const checkResult = await checkForUpdates(testDir);
      expect(checkResult.hasUpdate).toBe(true);
      expect(checkResult.latestVersion).toBe("99.0.0");
      expect(checkResult.manifest).toBeDefined();

      // پاکسازی
      try {
        fs.unlinkSync(path.join(testDir, "version.json"));
        fs.rmdirSync(testDir);
      } catch {}
    });
  });
});
