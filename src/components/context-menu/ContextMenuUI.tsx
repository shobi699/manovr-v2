"use client";

import React, { useLayoutEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ContextMenuGroup, ContextMenuItem, ContextMenuPosition } from "./types";
import { useOutsideClick } from "./useOutsideClick";

interface ContextMenuUIProps {
  isOpen: boolean;
  position: ContextMenuPosition;
  groups: ContextMenuGroup[];
  onClose: () => void;
}

export default function ContextMenuUI({
  isOpen,
  position,
  groups,
  onClose,
}: ContextMenuUIProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState<ContextMenuPosition>(position);

  // بستن امن منو در صورت کلیک در خارج از محدوده منو
  useOutsideClick(menuRef, onClose, isOpen);

  // محاسبه برخورد با لبه‌های صفحه و برگرداندن منو در صورت خروج از ویوپورت (RTL-aware Collision Detection)
  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const rect = menuRef.current.getBoundingClientRect();
    const padding = 12;
    let x = position.x;
    let y = position.y;

    // بررسی محدوده افقی (چپ و راست)
    if (x + rect.width > window.innerWidth - padding) {
      x = Math.max(padding, window.innerWidth - rect.width - padding);
    }
    if (x < padding) {
      x = padding;
    }

    // بررسی محدوده عمودی (بالا و پایین)
    if (y + rect.height > window.innerHeight - padding) {
      y = Math.max(padding, window.innerHeight - rect.height - padding);
    }
    if (y < padding) {
      y = padding;
    }

    setAdjustedPos({ x, y });
  }, [isOpen, position, groups]);

  // اجرای قطعی اکشن عملیاتی پیش از تخریب و بستن منو (Deterministic Action Invocation)
  const handleItemClick = useCallback(
    (e: React.MouseEvent, item: ContextMenuItem) => {
      e.preventDefault();
      e.stopPropagation();

      if (item.disabled) return;

      // ۱. فراخوانی اولیه و قطعی تابع اکشن
      if (typeof item.onClick === "function") {
        item.onClick();
      }

      // ۲. بستن منو پس از اجرای موفق دستور
      onClose();
    },
    [onClose]
  );

  // پشتیبانی کامل از دسترسی‌پذیری و تریگر کیبورد با Enter و Space
  const handleItemKeyDown = useCallback(
    (e: React.KeyboardEvent, item: ContextMenuItem) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();

        if (item.disabled) return;

        if (typeof item.onClick === "function") {
          item.onClick();
        }

        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen || groups.length === 0) return null;

  const getBadgeClass = (variant?: string) => {
    switch (variant) {
      case "good":
        return "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "warn":
        return "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "crit":
        return "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      case "accent":
        return "bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800";
      case "blue":
        return "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[9990] select-none"
        onContextMenu={(e) => {
          // جلوگیری از باز شدن منوی پیش‌فرض مرورگر در حین کلیک‌راست مجدد روی پس‌زمینه
          e.preventDefault();
        }}
        onMouseDown={(e) => {
          // اگر کلیک مستقیماً روی لایه پوششی رخ دهد منو بسته می‌شود
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <motion.div
          ref={menuRef}
          role="menu"
          aria-orientation="vertical"
          tabIndex={-1}
          dir="rtl"
          initial={{ opacity: 0, scale: 0.94, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -6 }}
          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "fixed",
            left: `${adjustedPos.x}px`,
            top: `${adjustedPos.y}px`,
          }}
          className="z-[9999] w-72 max-w-[calc(100vw-24px)] rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xl shadow-slate-950/25 p-1.5 text-slate-800 dark:text-slate-100 focus:outline-none pointer-events-auto"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {groups.map((group, groupIdx) => {
            if (!group.items || group.items.length === 0) return null;

            return (
              <div key={group.id} className="py-1">
                {group.title && (
                  <div className="flex items-center justify-between px-2.5 py-1.5 mb-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      {group.icon && <span className="opacity-70">{group.icon}</span>}
                      <span>{group.title}</span>
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                  </div>
                )}

                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    return (
                      <React.Fragment key={item.id}>
                        <button
                          type="button"
                          role="menuitem"
                          tabIndex={item.disabled ? -1 : 0}
                          disabled={item.disabled}
                          onClick={(e) => handleItemClick(e, item)}
                          onKeyDown={(e) => handleItemKeyDown(e, item)}
                          className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all group pointer-events-auto ${
                            item.disabled
                              ? "opacity-40 cursor-not-allowed text-slate-400"
                              : item.danger
                              ? "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 active:scale-[0.98] cursor-pointer"
                              : "hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-950 dark:hover:text-white active:scale-[0.98] cursor-pointer"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.icon && (
                              <div
                                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-sm transition-colors ${
                                  item.danger
                                    ? "bg-rose-100/60 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:text-blue-600 dark:group-hover:text-blue-400 border border-slate-200/50 dark:border-slate-700/50"
                                }`}
                              >
                                {item.icon}
                              </div>
                            )}
                            <div className="text-right truncate">
                              <div className="truncate">{item.label}</div>
                              {item.description && (
                                <div className="text-[10px] font-normal text-slate-400 dark:text-slate-500 truncate">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.badge && (
                              <span
                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${getBadgeClass(
                                  item.badgeVariant
                                )}`}
                              >
                                {item.badge}
                              </span>
                            )}
                            {item.shortcut && (
                              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200/70 dark:border-slate-700/70 shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
                                {item.shortcut}
                              </kbd>
                            )}
                          </div>
                        </button>
                        {item.separatorAfter && (
                          <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {groupIdx < groups.length - 1 && (
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                )}
              </div>
            );
          })}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
