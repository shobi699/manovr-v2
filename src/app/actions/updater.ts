"use server";

import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { checkForUpdates, getUpdateSharePath, getCurrentAppVersion } from "@/lib/auto-updater/version-checker";
import { preparePatch, spawnDetachedPatcher, getLocalUpdateDirectory } from "@/lib/auto-updater/patch-engine";
import { UpdateCheckResult, UpdateManifest } from "@/lib/auto-updater/types";
import path from "path";

/**
 * بررسی سرور برای دریافت وضعیت نسخه جدید
 */
export async function checkAppUpdatesAction(): Promise<{
  ok: boolean;
  result?: UpdateCheckResult;
  updateSharePath?: string;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "احراز هویت انجام نشده است." };
  }

  try {
    const sharePath = getUpdateSharePath();
    const result = await checkForUpdates(sharePath);
    return { ok: true, result, updateSharePath: sharePath };
  } catch (err: any) {
    return { ok: false, error: err?.message || "خطا در بررسی به‌روزرسانی" };
  }
}

/**
 * آماده‌سازی و دانلود فایل پچ از سرور اشتراکی به کلاینت
 */
export async function prepareAppPatchAction(manifest: UpdateManifest): Promise<{
  ok: boolean;
  patchFile?: string;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "احراز هویت انجام نشده است." };
  }

  const canUpdate = (await hasPerm(session, "updater.manage")) || (await hasPerm(session, "settings.global"));
  if (!canUpdate && session.role !== 1) {
    return { ok: false, error: "شما مجوز اعمال به‌روزرسانی سیستم را ندارید." };
  }

  try {
    const sharePath = getUpdateSharePath();
    const res = await preparePatch({ manifest, sharePath });
    return res;
  } catch (err: any) {
    return { ok: false, error: err?.message || "خطا در آماده‌سازی پچ" };
  }
}

/**
 * راه‌اندازی فرآیند مستقل پچر جهت جایگزینی فایل‌ها و ری‌استارت نرم‌افزار
 */
export async function applyAppUpdateAction(params: {
  patchZipPath: string;
  targetVersion: string;
}): Promise<{ ok: boolean; pid?: number; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "احراز هویت انجام نشده است." };
  }

  const canUpdate = (await hasPerm(session, "updater.manage")) || (await hasPerm(session, "settings.global"));
  if (!canUpdate && session.role !== 1) {
    return { ok: false, error: "شما مجوز اعمال به‌روزرسانی سیستم را ندارید." };
  }

  try {
    const appDir = process.cwd();
    const relaunchExePath = process.execPath;

    const res = spawnDetachedPatcher({
      patchZipPath: params.patchZipPath,
      appDir,
      relaunchExePath,
      targetVersion: params.targetVersion,
    });

    if (!res.success) {
      return { ok: false, error: res.error || "خطا در اجرای فرآیند پچ" };
    }

    return { ok: true, pid: res.pid };
  } catch (err: any) {
    return { ok: false, error: err?.message || "خطای نامشخص حین اعمال به‌روزرسانی" };
  }
}
