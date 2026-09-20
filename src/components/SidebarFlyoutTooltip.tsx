"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";

export interface FlyoutTooltipItem {
  anchorRect: DOMRect | null;
  title: string;
  category?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  isActive?: boolean;
  badge?: string;
  badgeVariant?: "default" | "warning" | "amber" | "success";
}

export interface SidebarFlyoutTooltipProps {
  item: FlyoutTooltipItem | null;
  navPos?: "right" | "left" | "top" | "bottom";
}

export default function SidebarFlyoutTooltip({
  item,
  navPos = "right",
}: SidebarFlyoutTooltipProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !item || !item.anchorRect) {
    return null;
  }

  const { anchorRect } = item;
  const isNavLeft = navPos === "left";

  // محاسبه موقعیت عمودی هم‌تراز با وسط آیکون
  const targetTop = anchorRect.top + anchorRect.height / 2;

  // موقعیت افقی وابسته به جهت سایدبار در حالت RTL
  const positionStyle: React.CSSProperties = {
    position: "fixed",
    top: `${targetTop}px`,
    zIndex: 99999,
    pointerEvents: "none",
  };

  if (isNavLeft) {
    // سایدبار در سمت چپ قرار دارد -> تول‌تیپ در سمت راست آن باز می‌شود
    positionStyle.left = `${anchorRect.right + 12}px`;
    positionStyle.transform = "translateY(-50%)";
  } else {
    // حالت پیش‌فرض و استاندارد مترو: سایدبار در سمت راست قرار دارد -> تول‌تیپ در سمت چپ باز می‌شود
    positionStyle.right = `${window.innerWidth - anchorRect.left + 12}px`;
    positionStyle.transform = "translateY(-50%)";
  }

  return createPortal(
    <AnimatePresence>
      <div
        key={`${item.title}-${targetTop}`}
        style={positionStyle}
        dir="rtl"
        role="tooltip"
        aria-hidden="true"
        className="select-none"
      >
        <motion.div
          initial={{ opacity: 0, x: isNavLeft ? -8 : 8, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: isNavLeft ? -4 : 4, scale: 0.97 }}
          transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="relative min-w-[140px] max-w-[260px] px-3.5 py-2 rounded-xl border shadow-2xl backdrop-blur-md bg-white/95 dark:bg-slate-900/95 border-slate-200/90 dark:border-slate-800/90 text-slate-800 dark:text-slate-100"
          style={{
            boxShadow:
              "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05)",
          }}
        >
          {/* پیکان اشاره‌گر متصل به آیکون */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800/90 ${
              isNavLeft
                ? "-start-1.5 border-b border-l"
                : "-end-1.5 border-t border-r"
            }`}
          />

          <div className="relative z-10 flex flex-col gap-1">
            {/* برچسب دسته‌بندی موضوعی یا نشانگر فعال بودن */}
            <div className="flex items-center justify-between gap-2">
              {item.category && (
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/90 px-1.5 py-0.5 rounded-md">
                  {item.category}
                </span>
              )}
              {item.isActive && (
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-1 border border-amber-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  صفحه جاری
                </span>
              )}
              {item.badge && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                    item.badgeVariant === "warning"
                      ? "text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/20"
                      : "text-slate-600 dark:text-slate-300 bg-slate-200/50 dark:bg-slate-800/60 border-slate-300/40 dark:border-slate-700/40"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </div>

            {/* سطر عنوان و آیکون */}
            <div className="flex items-center gap-2 pt-0.5">
              {item.icon && (
                <span className="text-slate-500 dark:text-slate-400 shrink-0">
                  {item.icon}
                </span>
              )}
              <span className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white leading-tight">
                {item.title}
              </span>
            </div>

            {/* زیرنویس تکمیلی / راهنمای اقدام */}
            {item.subtitle && (
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {item.subtitle}
              </span>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
