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

  useEffect(() => {
    channelsRef.current = channels;
  });

  useEffect(() => {
    const eventSource = new EventSource("/api/events");

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload && payload.channel && channelsRef.current.includes(payload.channel)) {
          router.refresh();

          if (typeof document !== "undefined" && document.hidden) {
            showDesktopNotification("بروزرسانی زنده سامانه مانور", "تغییرات جدید در مانورها یا ناوگان ثبت گردید.");
          }
        }
      } catch {
        // نادیده گرفتن خطاهای پارس داده‌های غیراستاندارد مثل سیگنال اتصال اولیه
      }
    };

    return () => {
      eventSource.close();
    };
  }, [channelKey, router]);
}
