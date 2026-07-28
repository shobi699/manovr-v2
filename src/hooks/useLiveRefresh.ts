import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useLiveRefresh(channels: string[]) {
  const router = useRouter();

  useEffect(() => {
    const eventSource = new EventSource("/api/events");

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload && payload.channel && channels.includes(payload.channel)) {
          console.log(`[SSE Live] Channel ${payload.channel} triggered page refresh.`);
          router.refresh();
        }
      } catch (err) {
        // نادیده گرفتن خطاهای پارس داده‌های غیراستاندارد مثل سیگنال اتصال اولیه
      }
    };

    return () => {
      eventSource.close();
    };
  }, [channels, router]);
}
