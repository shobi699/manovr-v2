import { EventEmitter } from "events";

const globalForEvents = globalThis as unknown as {
  sseEmitter: EventEmitter | undefined;
};

export const sseEmitter = globalForEvents.sseEmitter ?? new EventEmitter();

// هر اتصال SSE یک شنونده ثبت می‌کند. سقف پیش‌فرض Node برابر ۱۰ است و برای
// تعداد کاربران همزمان این سامانه کافی نیست. عدد زیر سقف هشدار است، نه محدودیت
// واقعی — اگر در عمل از این هم گذشت، نشانه نشتی شنونده است نه نیاز به افزایش.
sseEmitter.setMaxListeners(64);

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

/**
 * محتوای مجاز رویدادهای عمومی SSE.
 * فقط سیگنال ابطال کش — هیچ داده‌ی محرمانه‌ای نباید اینجا قرار گیرد.
 * مصرف‌کننده (useLiveRefresh) تنها فیلد channel را می‌خواند.
 */
export interface SSEBroadcast {
  /** شناسه رکورد تغییر یافته — برای ابطال هدفمند کش در آینده */
  id?: number;
  /** نوع عملیات: CREATE | UPDATE | DELETE | CONFIRM */
  action?: string;
}

// انتشار سیگنال عمومی تغییر — بدون هیچ داده‌ی محرمانه
export function emitEntityChanged(entity: string, payload: SSEBroadcast) {
  sseEmitter.emit("message", { channel: `${entity}_changed`, data: payload });
}
