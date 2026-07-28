import { EventEmitter } from "events";

const globalForEvents = globalThis as unknown as {
  sseEmitter: EventEmitter | undefined;
};

export const sseEmitter = globalForEvents.sseEmitter ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEvents.sseEmitter = sseEmitter;
}

// کانال‌ها و رویدادهای تعریف شده
export const EventChannels = {
  MANOVR_CHANGED: "manovr_changed",
  TRAIN_CHANGED: "train_changed",
  DEPOT_CHANGED: "depot_changed",
  NOTIFICATION_PREFIX: "notification:",
};

// انتشار یک رویداد به استریم SSE
export function emitSSEEvent(channel: string, data: any) {
  sseEmitter.emit("message", { channel, data });
}
