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
      // ارسال سیگنال اولیه اتصال
      controller.enqueue(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

      const onMessage = (event: { channel: string; data: any }) => {
        // مدیریت ارسال اعلان‌های شخصی یا عمومی
        if (event.channel.startsWith("notification:")) {
          const targetUserId = parseInt(event.channel.split(":")[1]) || 0;
          if (targetUserId !== session.id) return;
        }
        
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      };

      sseEmitter.on("message", onMessage);

      // ارسال سیگنال heartbeat برای باز نگه داشتن ارتباط
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(`: heartbeat\n\n`);
        } catch {
          // اتصال از سمت کلاینت بسته شده است
          clearInterval(heartbeat);
          sseEmitter.off("message", onMessage);
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        sseEmitter.off("message", onMessage);
      });
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
