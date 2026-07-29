import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { sseEmitter } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const responseStream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          // کلاینت قطع شده است — منابع را آزاد کن
          cleanup();
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        sseEmitter.off("message", onMessage);
      };

      // کانال‌های عمومی مجاز — فقط سیگنال ابطال کش، بدون داده‌ی محرمانه
      const isPersonalChannel = (channel: string) => channel.startsWith("notification:");

      const onMessage = (event: { channel: string; data: unknown }) => {
        if (isPersonalChannel(event.channel)) {
          const targetUserId = parseInt(event.channel.split(":")[1]) || 0;
          if (targetUserId !== session.id) return;
        }
        send(`data: ${JSON.stringify(event)}\n\n`);
      };

      const heartbeat = setInterval(() => {
        send(`: heartbeat\n\n`);
      }, 25000);

      sseEmitter.on("message", onMessage);
      send(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      // ReadableStream توسط مصرف‌کننده لغو شد
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
