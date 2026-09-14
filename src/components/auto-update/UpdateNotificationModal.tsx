"use client";

import React, { useState } from "react";
import { UpdateManifest, UpdateProgress } from "@/lib/auto-updater/types";

interface UpdateNotificationModalProps {
  manifest: UpdateManifest;
  currentVersion: string;
  isOpen: boolean;
  onClose: () => void;
  onApplyUpdate: () => Promise<void>;
  progress?: UpdateProgress | null;
}

export default function UpdateNotificationModal({
  manifest,
  currentVersion,
  isOpen,
  onClose,
  onApplyUpdate,
  progress,
}: UpdateNotificationModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<"features" | "fixes">("features");

  if (!isOpen) return null;

  const handleStartUpdate = async () => {
    setIsUpdating(true);
    try {
      await onApplyUpdate();
    } catch {
      setIsUpdating(false);
    }
  };

  const isWorking = Boolean(isUpdating || (progress && progress.status !== "idle" && progress.status !== "ready_to_install"));

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity duration-300 animate-fadeIn"
    >
      {/* دیزاین پنل شیشه‌ای Glassmorphism */}
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-900/85 p-6 shadow-2xl backdrop-blur-2xl text-slate-100 transition-all duration-300 transform scale-100">
        
        {/* هاله نور پس‌زمینه لطیف */}
        <div className="absolute -top-24 -start-24 w-48 h-48 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -end-24 w-48 h-48 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />

        {/* هدر مودال */}
        <div className="flex items-start justify-between border-b border-slate-800/80 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/30 border border-emerald-500/30 text-emerald-400 shadow-inner">
              <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">نسخه جدید نرم‌افزار مانور آماده است</h3>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300 border border-emerald-500/30">
                  نسخه {manifest.version}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                نسخه جاری: <span className="font-mono text-slate-300">{currentVersion}</span> • تاریخ انتشار: {manifest.releaseDateJalali}
              </p>
            </div>
          </div>

          {!manifest.mandatory && !isWorking && (
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition-colors"
              title="بستن"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* نکات برجسته به‌روزرسانی */}
        {manifest.changelog.highlights && manifest.changelog.highlights.length > 0 && (
          <div className="mb-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-slate-800/40 p-3.5 border border-emerald-500/20">
            <p className="text-xs font-semibold text-emerald-300 mb-1.5 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
              مهم‌ترین دستاوردهای این به‌روزرسانی:
            </p>
            <ul className="space-y-1 text-xs text-slate-300 ps-4 list-disc">
              {manifest.changelog.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </div>
        )}

        {/* تب‌های لاگ تغییرات (Features / Fixes) */}
        <div className="mb-4">
          <div className="flex border-b border-slate-800 text-xs font-medium text-slate-400">
            <button
              onClick={() => setActiveTab("features")}
              className={`pb-2 pe-4 ps-2 transition-all border-b-2 ${
                activeTab === "features"
                  ? "border-emerald-400 text-emerald-300 font-semibold"
                  : "border-transparent hover:text-slate-200"
              }`}
            >
              ویژگی‌ها و قابلیت‌های جدید ({manifest.changelog.features.length})
            </button>
            <button
              onClick={() => setActiveTab("fixes")}
              className={`pb-2 pe-4 ps-2 transition-all border-b-2 ${
                activeTab === "fixes"
                  ? "border-emerald-400 text-emerald-300 font-semibold"
                  : "border-transparent hover:text-slate-200"
              }`}
            >
              رفع اشکالات و پایداری ({manifest.changelog.fixes.length})
            </button>
          </div>

          <div className="mt-3 max-h-40 overflow-y-auto pe-1 custom-scrollbar text-xs text-slate-300 space-y-2">
            {activeTab === "features" ? (
              manifest.changelog.features.length > 0 ? (
                manifest.changelog.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 bg-slate-800/30 p-2 rounded-xl border border-slate-800/40">
                    <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                    <span>{f}</span>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 py-2">موردی برای نمایش وجود ندارد.</p>
              )
            ) : manifest.changelog.fixes.length > 0 ? (
              manifest.changelog.fixes.map((fx, i) => (
                <div key={i} className="flex items-start gap-2 bg-slate-800/30 p-2 rounded-xl border border-slate-800/40">
                  <span className="text-blue-400 font-bold mt-0.5">•</span>
                  <span>{fx}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-500 py-2">موردی برای نمایش وجود ندارد.</p>
            )}
          </div>
        </div>

        {/* وضعیت پیشرفت عملیات در حین دانلود و اعمال */}
        {isWorking && progress && (
          <div className="mb-5 rounded-2xl bg-slate-950/50 p-4 border border-slate-800">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="text-slate-300 font-medium">{progress.message}</span>
              <span className="font-mono text-emerald-400 font-bold">{progress.percentage}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-400 to-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            {progress.error && (
              <p className="mt-2 text-xs text-rose-400 font-medium">{progress.error}</p>
            )}
          </div>
        )}

        {/* اکشن‌ها و دکمه‌های کنترل */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
          {!manifest.mandatory && !isWorking && (
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800/60 hover:text-white transition-colors"
            >
              یادآوری در ورود بعدی
            </button>
          )}

          <button
            disabled={isWorking}
            onClick={handleStartUpdate}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-lg transition-all duration-200 ${
              isWorking
                ? "bg-slate-700 cursor-not-allowed text-slate-400 opacity-60"
                : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 hover:shadow-emerald-900/30 active:scale-[0.98]"
            }`}
          >
            {isWorking ? (
              <>
                <svg className="animate-spin -ms-1 me-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                در حال پردازش پچ...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                اکنون به‌روزرسانی کنید
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
