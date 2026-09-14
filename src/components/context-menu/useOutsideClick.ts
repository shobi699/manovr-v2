"use client";

import { useEffect, RefObject } from "react";

/**
 * هوک مدیریت کلیک خارج از محدوده المان (Outside Click)
 * این هوک اطمینان حاصل می‌کند که رویدادهای کلیک یا mousedown درون المان
 * باعث بسته‌شدن نابهنگام یا جلوگیری از اجرای رویدادهای داخلی المان نمی‌شوند.
 */
export function useOutsideClick<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null>,
  onOutsideClick: (e: MouseEvent | TouchEvent) => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      // اگر المان رفرنس وجود داشته باشد و کلیک درون آن رخ داده باشد، رویداد نادیده گرفته می‌شود
      if (ref.current && ref.current.contains(target)) {
        return;
      }

      onOutsideClick(e);
    };

    // شنود رویدادهای mousedown و touchstart در فاز bubble سند
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [ref, onOutsideClick, enabled]);
}
