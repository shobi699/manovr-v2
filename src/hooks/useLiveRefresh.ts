import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { showDesktopNotification } from "@/lib/electron-notify";

export function useLiveRefresh(channels: string[]) {
  const router = useRouter();

  // کلید پایدار از روی محتوای آرایه — تا تغییر ارجاع در هر رندر
  // باعث بستن و باز کردن دوباره اتصال SSE نشود
  const channelKey = useMemo(() => [...channels].sort().join("|"), [channels]);

  // آخرین لیست کانال‌ها بدون ایجاد وابستگی در افکت
  const channelsRef = useRef(channels);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshTimeRef = useRef<number>(0);

  useEffect(() => {
    channelsRef.current = channels;
  });

  useEffect(() => {
    // تابع رفرش کنترل‌شده با دی‌بانس هوشمند برای تجمیع رویدادهای هم‌زمان
    const triggerControlledRefresh = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const now = Date.now();
        // حصول اطمینان از حداقل فاصله ۳ ثانیه‌ای بین رفرش‌های صفحه
        if (now - lastRefreshTimeRef.current >= 3000) {
          lastRefreshTimeRef.current = now;
          router.refresh();
        }
      }, 750);
    };

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/events");

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.channel && channelsRef.current.includes(payload.channel)) {
            triggerControlledRefresh();

            if (typeof document !== "undefined" && document.hidden) {
              showDesktopNotification("بروزرسانی زنده سامانه مانور", "تغییرات جدید در مانورها یا ناوگان ثبت گردید.");
            }
          }
        } catch {
          // نادیده گرفتن خطاهای پارس داده‌های غیراستاندارد مثل سیگنال اتصال اولیه
        }
      };
    } catch {
      // در صورت عدم دسترسی به SSE در محیط کلاینت
    }

    // همگام‌سازی هنگام بازگشت کاربر به پنجره برنامه (تنها در صورتی که حداقل ۸ ثانیه گذشته باشد)
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        const now = Date.now();
        if (now - lastRefreshTimeRef.current >= 8000) {
          lastRefreshTimeRef.current = now;
          router.refresh();
        }
      }
    };

    const handleFocus = () => {
      handleVisibilityChange();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleFocus);
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    // پولینگ هدفمند فالبک (هر ۴۵ ثانیه) صرفاً در صورتی که پنجره فعال باشد
    const intervalId = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        const now = Date.now();
        if (now - lastRefreshTimeRef.current >= 45000) {
          lastRefreshTimeRef.current = now;
          router.refresh();
        }
      }
    }, 45000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (eventSource) {
        eventSource.close();
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleFocus);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      clearInterval(intervalId);
    };
  }, [channelKey, router]);
}
