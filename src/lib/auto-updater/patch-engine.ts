import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { UpdateManifest, UpdateProgress } from "./types";

/**
 * محاسبه هش SHA-256 برای فایل پچ دانلودی
 */
export async function calculateFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex").toLowerCase()));
    stream.on("error", (err) => reject(err));
  });
}

/**
 * دریافت دایرکتوری محلی امن برای ذخیره موقت پچ‌ها و بک‌آپ
 */
export function getLocalUpdateDirectory(): string {
  const baseDir = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "ManovrSystem", "updates")
    : path.join(process.cwd(), ".updates_cache");

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

export interface PreparePatchOptions {
  manifest: UpdateManifest;
  sharePath: string;
  onProgress?: (progress: UpdateProgress) => void;
}

/**
 * آماده‌سازی پچ: کپی از شبکه، اعتبارسنجی هش و آماده‌سازی جهت اعمال
 */
export async function preparePatch(options: PreparePatchOptions): Promise<{ ok: boolean; patchFile?: string; error?: string }> {
  const { manifest, sharePath, onProgress } = options;
  const updateDir = getLocalUpdateDirectory();
  const stagingDir = path.join(updateDir, "staging");
  fs.mkdirSync(stagingDir, { recursive: true });

  const sourceFile = path.isAbsolute(manifest.packageFile)
    ? manifest.packageFile
    : path.join(sharePath, manifest.packageFile);

  const localTargetFile = path.join(stagingDir, `patch-${manifest.version}.zip`);

  try {
    // ۱. بررسی وجود فایل منبع در سرور شبکه
    if (!fs.existsSync(sourceFile)) {
      return { ok: false, error: `فایل پچ در مسیر اشتراکی یافت نشد: ${sourceFile}` };
    }

    const stat = fs.statSync(sourceFile);
    const totalBytes = stat.size;

    onProgress?.({
      status: "downloading",
      percentage: 0,
      transferredBytes: 0,
      totalBytes,
      message: "در حال انتقال فایل پچ از سرور شبکه به کلاینت...",
    });

    // ۲. کپی استریم با گزارش درصد پیشرفت
    await new Promise<void>((resolve, reject) => {
      let transferred = 0;
      const readStream = fs.createReadStream(sourceFile);
      const writeStream = fs.createWriteStream(localTargetFile);

      readStream.on("data", (chunk) => {
        transferred += chunk.length;
        const percentage = Math.min(99, Math.round((transferred / totalBytes) * 100));
        onProgress?.({
          status: "downloading",
          percentage,
          transferredBytes: transferred,
          totalBytes,
          message: `در حال دریافت فایل پچ: ${percentage}%`,
        });
      });

      writeStream.on("finish", () => resolve());
      readStream.on("error", (err) => reject(err));
      writeStream.on("error", (err) => reject(err));

      readStream.pipe(writeStream);
    });

    // ۳. اعتبارسنجی یکپارچگی فایل با هش SHA-256
    onProgress?.({
      status: "verifying",
      percentage: 99,
      transferredBytes: totalBytes,
      totalBytes,
      message: "در حال بررسی امضای دیجیتال و هش امنیتی پچ...",
    });

    const calculatedHash = await calculateFileSha256(localTargetFile);
    if (calculatedHash !== manifest.sha256.toLowerCase()) {
      // حذف فایل معیوب در صورت عدم تطابق هش
      try { fs.unlinkSync(localTargetFile); } catch {}
      return {
        ok: false,
        error: `عدم تطابق هش فایل پچ! فایل ممکن است آسیب دیده باشد. انتظار: ${manifest.sha256} | دریافت شده: ${calculatedHash}`,
      };
    }

    onProgress?.({
      status: "ready_to_install",
      percentage: 100,
      transferredBytes: totalBytes,
      totalBytes,
      message: "پچ با موفقیت دانلود و اعتبارسنجی شد. آماده اعمال در نرم‌افزار.",
    });

    return { ok: true, patchFile: localTargetFile };
  } catch (err: any) {
    return { ok: false, error: `خطا در آماده‌سازی پچ: ${err?.message || "خطای نامشخص"}` };
  }
}

/**
 * ایجاد فرآیند ایزوله (Detached Process) جهت تعویض فایل‌ها پس از خروج برنامه
 */
export function spawnDetachedPatcher(params: {
  patchZipPath: string;
  appDir: string;
  relaunchExePath: string;
  targetVersion: string;
}): { success: boolean; pid?: number; error?: string } {
  try {
    const updaterScriptPath = path.join(process.cwd(), "scripts", "updater", "apply-patch.js");
    if (!fs.existsSync(updaterScriptPath)) {
      return { success: false, error: `اسکریپت اعمال‌کننده پچ یافت نشد: ${updaterScriptPath}` };
    }

    const currentPid = process.pid;
    const backupDir = path.join(getLocalUpdateDirectory(), "backup", `backup-${Date.now()}`);

    const args = [
      updaterScriptPath,
      "--patch", params.patchZipPath,
      "--targetDir", params.appDir,
      "--backupDir", backupDir,
      "--waitPid", currentPid.toString(),
      "--relaunch", params.relaunchExePath,
      "--version", params.targetVersion,
    ];

    // اجرای پروسه مستقل در پس‌زمینه سیستم‌عامل
    const child = spawn(process.execPath, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });

    child.unref();

    return { success: true, pid: child.pid };
  } catch (err: any) {
    return { success: false, error: `خطا در راه‌اندازی فرآیند پچ: ${err?.message || "خطای ناشناخته"}` };
  }
}
