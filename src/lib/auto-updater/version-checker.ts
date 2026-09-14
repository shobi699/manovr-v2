import fs from "fs";
import path from "path";
import { updateManifestSchema, UpdateCheckResult, UpdateManifest } from "./types";

/**
 * تجزیه رشته نسخه معنایی (SemVer: Major.Minor.Patch)
 */
export function parseSemVer(versionStr: string): [number, number, number] {
  const cleanVersion = versionStr.trim().replace(/^v/i, "").split("-")[0];
  const parts = cleanVersion.split(".").map((p) => {
    const num = parseInt(p, 10);
    return isNaN(num) ? 0 : num;
  });

  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/**
 * مقایسه دو نسخه معنایی:
 * - خروجی ۱ اگر v1 بزرگتر از v2 باشد (v1 جدیدتر است)
 * - خروجی -۱ اگر v1 کوچکتر از v2 باشد (v2 جدیدتر است)
 * - خروجی ۰ اگر دو نسخه برابر باشند
 */
export function compareSemVer(v1: string, v2: string): number {
  const [major1, minor1, patch1] = parseSemVer(v1);
  const [major2, minor2, patch2] = parseSemVer(v2);

  if (major1 !== major2) return major1 > major2 ? 1 : -1;
  if (minor1 !== minor2) return minor1 > minor2 ? 1 : -1;
  if (patch1 !== patch2) return patch1 > patch2 ? 1 : -1;
  return 0;
}

/**
 * خواندن مسیر شبکه به‌روزرسانی از فایل تنظیمات یا مسیرهای پیش‌فرض
 */
export function getUpdateSharePath(): string {
  try {
    const configPath = path.join(process.cwd(), "manovr-config.json");
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(content);
      if (config.sharedUpdatePath && typeof config.sharedUpdatePath === "string") {
        return config.sharedUpdatePath;
      }
      if (config.sharedDataPath && typeof config.sharedDataPath === "string") {
        // مشتق‌گیری خودکار پوشه updates در کنار data
        return path.join(path.dirname(config.sharedDataPath), "updates");
      }
    }
  } catch {
    // نادیده‌گیری خطا و استفاده از مسیر پیش‌فرض
  }

  // مسیر پیش‌فرض سرور اشتراکی راه‌آهن
  return "\\\\srvdfs01\\Line1\\Depo\\updates";
}

/**
 * خواندن نسخه جاری برنامه از package.json یا ثابت برنامه
 */
export function getCurrentAppVersion(): string {
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (pkg.version) return pkg.version;
    }
  } catch {
    // fallback
  }
  return "0.1.0";
}

/**
 * بررسی وجود نسخه جدید در پوشه اشتراکی شبکه
 */
export async function checkForUpdates(customSharePath?: string): Promise<UpdateCheckResult> {
  const currentVersion = getCurrentAppVersion();
  const sharePath = customSharePath || getUpdateSharePath();
  const manifestFile = path.join(sharePath, "version.json");

  try {
    if (!fs.existsSync(manifestFile)) {
      return {
        hasUpdate: false,
        currentVersion,
        error: `فایل مانیفست نسخه در مسیر شبکه یافت نشد: ${manifestFile}`,
      };
    }

    const rawContent = fs.readFileSync(manifestFile, "utf-8");
    const parsedJson = JSON.parse(rawContent);

    // اعتبارسنجی دقیق ساختار با Zod
    const validation = updateManifestSchema.safeParse(parsedJson);
    if (!validation.success) {
      const issues = validation.error.issues || (validation.error as any).errors || [];
      const errDetail = issues.map((e: any) => `${e.path.join(".")}: ${e.message}`).join(" | ");
      return {
        hasUpdate: false,
        currentVersion,
        error: `فایل version.json معتبر نیست: ${errDetail}`,
      };
    }

    const manifest: UpdateManifest = validation.data;
    const isNewer = compareSemVer(manifest.version, currentVersion) > 0;

    return {
      hasUpdate: isNewer,
      currentVersion,
      latestVersion: manifest.version,
      manifest: isNewer ? manifest : undefined,
      manifestPath: manifestFile,
    };
  } catch (err: any) {
    return {
      hasUpdate: false,
      currentVersion,
      error: `عدم دسترسی به پوشه اشتراکی شبکه: ${err?.message || "خطای نامشخص"}`,
    };
  }
}
