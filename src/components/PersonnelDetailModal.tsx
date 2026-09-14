"use client";

import React, { useEffect } from "react";
import { useToast } from "@/components/ui/Toast";

export interface DetailedPersonnelItem {
  id: number;
  firstName: string;
  lastName: string;
  phone1: string;
  phone2: string;
  internalTel: string;
  address: string;
  avatarColor: string;
  shift: number;
  orgPosition: number;
  personnelCode?: string | null;
}

interface PersonnelDetailModalProps {
  isOpen: boolean;
  personnel: DetailedPersonnelItem | null;
  onClose: () => void;
  shifts: Record<number, string>;
  positions: Record<number, string>;
  canEdit?: boolean;
  onEdit?: (person: DetailedPersonnelItem) => void;
}

export default function PersonnelDetailModal({
  isOpen,
  personnel,
  onClose,
  shifts,
  positions,
  canEdit = false,
  onEdit,
}: PersonnelDetailModalProps) {
  const { toast } = useToast();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !personnel) return null;

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} در حافظه کپی شد: ${text}`);
  };

  const handleCopyAllInfo = () => {
    const lines = [
      `👤 نام و نام خانوادگی: ${personnel.firstName} ${personnel.lastName}`,
      personnel.personnelCode ? `🪪 کد پرسنلی: ${personnel.personnelCode}` : null,
      `💼 سمت سازمانی: ${positions[personnel.orgPosition] || "سایر"}`,
      `⏱ شیفت کاری: شیفت ${shifts[personnel.shift] || "—"}`,
      personnel.phone1 ? `📱 تلفن همراه ۱: ${personnel.phone1}` : null,
      personnel.phone2 ? `📱 تلفن همراه ۲: ${personnel.phone2}` : null,
      personnel.internalTel ? `☎️ تلفن داخلی پایانه: ${personnel.internalTel}` : null,
      personnel.address ? `🏠 نشانی: ${personnel.address}` : null,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("شناسنامه کامل مخاطب در حافظه کپی شد.");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="personnel-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6 sm:p-8 space-y-6 text-slate-900 dark:text-slate-100">
        {/* هدر مدال: آواتار بزرگ، نام و نشان‌های سازمانی */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b border-slate-200 dark:border-slate-800">
          {/* آواتار برجسته */}
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg ring-4 ring-slate-100 dark:ring-slate-800 shrink-0 select-none"
            style={{ backgroundColor: personnel.avatarColor || "#2563eb" }}
          >
            {personnel.firstName[0]}
          </div>

          {/* اطلاعات هویتی و عناوین */}
          <div className="flex-1 text-center sm:text-right space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
              <h2
                id="personnel-modal-title"
                className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white"
              >
                {personnel.firstName} {personnel.lastName}
              </h2>

              {personnel.personnelCode && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">کد پرسنلی:</span>
                  <span className="tracking-wide text-slate-900 dark:text-white">{personnel.personnelCode}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(personnel.personnelCode!, "کد پرسنلی")}
                    className="ms-1 text-slate-400 hover:text-blue-500 focus:outline-none transition"
                    title="کپی کد پرسنلی"
                  >
                    📋
                  </button>
                </div>
              )}
            </div>

            {/* بج‌های سمت و شیفت کاری */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/70">
                {positions[personnel.orgPosition] || "سایر پرسنل"}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70">
                شیفت کاری {shifts[personnel.shift] || "—"}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70">
                پایانه فتح‌آباد (خط ۱)
              </span>
            </div>
          </div>

          {/* دکمه ضربدر بستن */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 left-5 w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition"
            title="بستن پنجره"
          >
            <span className="text-xl font-bold">✕</span>
          </button>
        </div>

        {/* کالبد اصلی مشخصات: کارت‌های تفکیک‌شده با فونت درشت و خوانا */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* کارت تلفن همراه اول */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <span className="text-base">📱</span> تلفن همراه اول (اصلی):
              </span>
              {personnel.phone1 && (
                <button
                  type="button"
                  onClick={() => handleCopy(personnel.phone1, "تلفن همراه ۱")}
                  className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 font-semibold transition"
                >
                  کپی شماره
                </button>
              )}
            </div>
            {personnel.phone1 ? (
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-lg sm:text-xl font-mono font-black text-slate-900 dark:text-white tracking-wider">
                  {personnel.phone1}
                </span>
                <a
                  href={`tel:${personnel.phone1}`}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1 transition"
                >
                  <span>📞</span> تماس تلفنی
                </a>
              </div>
            ) : (
              <div className="pt-1">
                <span className="text-sm font-medium text-slate-400 dark:text-slate-400 italic bg-slate-100/80 dark:bg-slate-900/60 px-3 py-1.5 rounded-lg inline-block border border-slate-200/50 dark:border-slate-700/50">
                  ثبت نشده است
                </span>
              </div>
            )}
          </div>

          {/* کارت تلفن همراه دوم */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <span className="text-base">📱</span> تلفن همراه دوم (پشتیبان):
              </span>
              {personnel.phone2 && (
                <button
                  type="button"
                  onClick={() => handleCopy(personnel.phone2, "تلفن همراه ۲")}
                  className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 font-semibold transition"
                >
                  کپی شماره
                </button>
              )}
            </div>
            {personnel.phone2 ? (
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-lg sm:text-xl font-mono font-black text-slate-900 dark:text-white tracking-wider">
                  {personnel.phone2}
                </span>
                <a
                  href={`tel:${personnel.phone2}`}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1 transition"
                >
                  <span>📞</span> تماس تلفنی
                </a>
              </div>
            ) : (
              <div className="pt-1">
                <span className="text-sm font-medium text-slate-400 dark:text-slate-400 italic bg-slate-100/80 dark:bg-slate-900/60 px-3 py-1.5 rounded-lg inline-block border border-slate-200/50 dark:border-slate-700/50">
                  ثبت نشده است
                </span>
              </div>
            )}
          </div>

          {/* کارت تلفن داخلی پایانه (برجسته و ویژه) */}
          <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 space-y-2.5 md:col-span-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <span className="text-base">☎️</span> تلفن داخلی اتاق کنترل و پایانه دپو:
              </span>
              {personnel.internalTel && (
                <button
                  type="button"
                  onClick={() => handleCopy(personnel.internalTel, "تلفن داخلی")}
                  className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 font-bold hover:bg-blue-50 dark:hover:bg-blue-900/50 transition shadow-sm"
                >
                  کپی داخلی
                </button>
              )}
            </div>
            {personnel.internalTel ? (
              <div className="flex items-baseline gap-3 pt-1">
                <span className="text-3xl font-mono font-black text-blue-700 dark:text-blue-400 tracking-widest">
                  {personnel.internalTel}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  (اتصال از طریق سانترال داخلی پایانه فتح‌آباد)
                </span>
              </div>
            ) : (
              <div className="pt-1">
                <span className="text-sm font-medium text-slate-400 dark:text-slate-400 italic bg-white/70 dark:bg-slate-900/60 px-3 py-1.5 rounded-lg inline-block border border-blue-100 dark:border-blue-900/40">
                  فاقد شماره داخلی مستقل
                </span>
              </div>
            )}
          </div>

          {/* کارت نشانی محل سکونت */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 space-y-2 md:col-span-2 shadow-sm">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <span className="text-base">🏠</span> آدرس و نشانی محل سکونت:
            </span>
            {personnel.address ? (
              <p className="text-sm sm:text-base text-slate-800 dark:text-slate-100 leading-relaxed font-semibold pt-1">
                {personnel.address}
              </p>
            ) : (
              <div className="pt-1">
                <span className="text-sm font-medium text-slate-400 dark:text-slate-400 italic bg-slate-100/80 dark:bg-slate-900/60 px-3 py-1.5 rounded-lg inline-block border border-slate-200/50 dark:border-slate-700/50">
                  نشانی سکونت در سیستم ثبت نشده است.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* فوتر مدال و اکشن‌های سریع */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyAllInfo}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-bold text-slate-800 dark:text-slate-100 transition shadow-sm"
            >
              <span>📑</span> کپی شناسنامه کامل
            </button>
            {canEdit && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(personnel);
                }}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-md shadow-blue-500/20"
              >
                <span>✏️</span> ویرایش اطلاعات
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-7 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-sm font-bold transition"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
}
