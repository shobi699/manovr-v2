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
  const lastRefreshRef = useRef<number>(0);

  useEffect(() => {
    channelsRef.current = channels;
  });

  useEffect(() => {
    // مقداردهی اولیه زمان آخرین رفرش در افکت
    if (lastRefreshRef.current === 0) {
      lastRefreshRef.current = Date.now();
    }

    // تابع کنترل‌شده برای رفرش با تراتل حداقل ۸ ثانیه‌ای
    const throttledRefresh = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current >= 8000) {
        lastRefreshRef.current = now;
        router.refresh();
      }
    };

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/events");

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.channel && channelsRef.current.includes(payload.channel)) {
            lastRefreshRef.current = Date.now();
            router.refresh();

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
        throttledRefresh();
      }
    };

    const handleFocus = () => {
      throttledRefresh();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleFocus);
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    // پولینگ هدفمند فالبک (هر ۶۰ ثانیه به جای ۱۵ ثانیه) صرفاً در صورتی که پنجره فعال باشد
    const intervalId = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        throttledRefresh();
      }
    }, 30000);

    return () => {
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

