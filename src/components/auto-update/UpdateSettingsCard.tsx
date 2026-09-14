"use client";

import React, { useState } from "react";
import { checkAppUpdatesAction, prepareAppPatchAction, applyAppUpdateAction } from "@/app/actions/updater";
import { UpdateCheckResult, UpdateManifest, UpdateProgress } from "@/lib/auto-updater/types";
import UpdateNotificationModal from "./UpdateNotificationModal";

interface UpdateSettingsCardProps {
  currentAppVersion: string;
}

export default function UpdateSettingsCard({ currentAppVersion }: UpdateSettingsCardProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<UpdateCheckResult | null>(null);
  const [sharePath, setSharePath] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCheckUpdates = async () => {
    setIsChecking(true);
    setErrorMessage(null);
    try {
      const res = await checkAppUpdatesAction();
      if (res.ok && res.result) {
        setCheckResult(res.result);
        if (res.updateSharePath) setSharePath(res.updateSharePath);
        if (res.result.hasUpdate && res.result.manifest) {
          setIsModalOpen(true);
        }
      } else {
        setErrorMessage(res.error || "خطا در بررسی سرور به‌روزرسانی");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "عدم برقراری ارتباط با سرور شبکه");
    } finally {
      setIsChecking(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (!checkResult?.manifest) return;
    const manifest = checkResult.manifest;

    setProgress({
      status: "downloading",
      percentage: 20,
      transferredBytes: 0,
      totalBytes: manifest.fileSizeBytes,
      message: "در حال دریافت فایل پچ از پوشه اشتراکی سرور...",
    });

    try {
      // ۱. دانلود و آماده‌سازی پچ
      const prepRes = await prepareAppPatchAction(manifest);
      if (!prepRes.ok || !prepRes.patchFile) {
        throw new Error(prepRes.error || "خطا در آماده‌سازی پچ");
      }

      setProgress({
        status: "ready_to_install",
        percentage: 100,
        transferredBytes: manifest.fileSizeBytes,
        totalBytes: manifest.fileSizeBytes,
        message: "پچ آماده شد. در حال راه‌اندازی فرآیند مستقل جایگزینی و ری‌استارت...",
      });

      // ۲. راه‌اندازی پروسه مستقل و خروج
      const applyRes = await applyAppUpdateAction({
        patchZipPath: prepRes.patchFile,
        targetVersion: manifest.version,
      });

      if (!applyRes.ok) {
        throw new Error(applyRes.error || "خطا در اجرای فرآیند جایگزینی");
      }

      // نرم‌افزار به زودی توسط سیستم‌عامل ری‌استارت می‌شود
    } catch (err: any) {
      setProgress({
        status: "error",
        percentage: 0,
        transferredBytes: 0,
        totalBytes: 0,
        message: "خطا در فرآیند به‌روزرسانی",
        error: err?.message || "خطای ناشناخته",
      });
      throw err;
    }
  };

  return (
    <div dir="rtl" className="card mt-6 border border-slate-700/60 bg-slate-900/60 backdrop-blur-xl rounded-2xl p-5 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">مرکز به‌روزرسانی هوشمند نرم‌افزار</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              سیستم پچینگ سبک بدون اینستالر مبتنی بر سرور شبکه راه‌آهن
            </p>
          </div>
        </div>

        <button
          disabled={isChecking}
          onClick={handleCheckUpdates}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 transition-all shadow-md"
        >
          {isChecking ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              در حال استعلام سرور...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              بررسی نسخه جدید
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800/60 flex items-center justify-between">
          <span className="text-slate-400">نسخه نصب‌شده فعلی:</span>
          <span className="font-mono font-bold text-slate-200 px-2.5 py-0.5 bg-slate-800 rounded-lg border border-slate-700/50">
            {currentAppVersion}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800/60 flex items-center justify-between">
          <span className="text-slate-400">مسیر سرور به‌روزرسانی:</span>
          <span className="font-mono text-[11px] text-emerald-400 truncate max-w-[200px]" title={sharePath}>
            {sharePath || "سرور مرکزی دپو"}
          </span>
        </div>
      </div>

      {checkResult && !checkResult.hasUpdate && !errorMessage && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
          <span>✓</span>
          <span>شما در حال استفاده از آخرین نسخه پایدار نرم‌افزار هستید. نیازی به به‌روزرسانی نیست.</span>
        </div>
      )}

      {checkResult?.hasUpdate && checkResult.manifest && (
        <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 to-slate-800/40 border border-emerald-500/30 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-300 font-medium">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span>نسخه جدید {checkResult.manifest.version} در سرور شبکه موجود است!</span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-xs text-emerald-400 hover:text-emerald-300 underline font-semibold"
          >
            مشاهده جزییات و ارتقا
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 p-3 rounded-xl bg-rose-950/20 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
          <span>⚠</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* مودال اعلان پچ */}
      {checkResult?.manifest && (
        <UpdateNotificationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          manifest={checkResult.manifest}
          currentVersion={currentAppVersion}
          onApplyUpdate={handleApplyUpdate}
          progress={progress}
        />
      )}
    </div>
  );
}
