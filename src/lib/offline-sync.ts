import fs from "fs";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { emitSSEEvent } from "@/lib/events";
import { getNetworkStatus } from "@/lib/network-status";
import { getOfflinePolicy } from "@/lib/settings";

export type OfflineActionType =
  | "CREATE_MANOVR"
  | "UPDATE_TRAIN_STATUS"
  | "RELOCATE_TRAIN"
  | "UPDATE_TRAIN_FLAGS";

export interface OfflineAction {
  id: string;
  actionType: OfflineActionType;
  data: any;
  timestamp: string; // زمان ثبت واقعی توسط کاربر جهت مرتب‌سازی زمانی دقیق
  userId?: number | null;
  userFullName?: string | null;
}

export interface OfflineSyncStatus {
  queueLength: number;
  hasStaleItems: boolean;
  staleWarningMessage: string | null;
  oldestItemAgeMs: number;
  oldestItemTimestamp: string | null;
  policy: "auto_sync" | "read_only";
  isSyncing: boolean;
  lastSyncAttempt: string | null;
}

export const FAST_OFFLINE_TIMEOUT_MS = 3000; // سقف استاندارد ۳ ثانیه برای پاسخ‌دهی سرور قبل از انتقال خودکار به صف آفلاین

/**
 * اجرای عملیات با سقف زمانی مشخص جهت جلوگیری قطعی از معطلی کاربر در شبکه‌های کند
 * در صورت بروز تاخیر بالای ۳ ثانیه یا خطای شبکه، عملیات بی‌درنگ در صف آفلاین ذخیره شده و موفقیت برمی‌گرداند.
 */
export async function withFastOfflineFallback<T>(
  actionPromise: () => Promise<T>,
  onFallbackToOffline: () => Promise<void>,
  timeoutMs: number = FAST_OFFLINE_TIMEOUT_MS
): Promise<{ result?: T; wasOfflineFallback: boolean; error?: string }> {
  let timer: any = null;
  try {
    const timeoutPromise = new Promise<{ isTimeout: true }>((resolve) => {
      timer = setTimeout(() => resolve({ isTimeout: true }), timeoutMs);
    });

    const executionPromise = actionPromise().then((res) => {
      if (timer) clearTimeout(timer);
      return { res, isTimeout: false as const };
    });

    const raceResult = await Promise.race([executionPromise, timeoutPromise]);

    if (raceResult.isTimeout) {
      console.warn(
        `[FastOfflineFallback] عملیات سرور در مدت ${timeoutMs}ms تکمیل نشد (کندی شبکه دپو). انتقال فوری به صف آفلاین محلی...`
      );
      await onFallbackToOffline();
      return { wasOfflineFallback: true };
    }

    return { result: raceResult.res, wasOfflineFallback: false };
  } catch (err: any) {
    if (timer) clearTimeout(timer);
    console.warn(`[FastOfflineFallback] خطا یا تاخیر در اجرای عملیات سرور، انتقال به صف آفلاین:`, err?.message || err);
    await onFallbackToOffline();
    return { wasOfflineFallback: true };
  }
}

const OFFLINE_QUEUE_KEY = "offline_sync_queue";

/**
 * دریافت مسیر فایل محلی ذخیره صف آفلاین به عنوان پشتیبان ایمن
 */
function getLocalQueueFilePath(): string {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
  return path.join(dir, "offline_queue.json");
}

/**
 * خواندن لیست صف رکوردهای آفلاین منتظر ارسال به سرور
 */
export async function getOfflineQueue(): Promise<OfflineAction[]> {
  try {
    // ۱. خواندن از تنظیمات سراسری دیتابیس
    const setting = await prisma.appSetting.findUnique({
      where: { scope_userId_key: { scope: "global", userId: 0, key: OFFLINE_QUEUE_KEY } },
    });

    if (setting && setting.value) {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  // ۲. فالبک به فایل محلی
  try {
    const filePath = getLocalQueueFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  return [];
}

// وضعیت سراسری همگام‌سازی در حافظه
let globalIsSyncing = false;
let globalLastSyncAttempt: string | null = null;
let syncIntervalHandle: NodeJS.Timeout | null = null;


/**
 * دریافت وضعیت تحلیلی صف و بررسی هشدارهای ماندگاری بیش از ۱۰ دقیقه
 */
export async function getOfflineSyncStatus(): Promise<OfflineSyncStatus> {
  const queue = await getOfflineQueue();
  const policy = await getOfflinePolicy();
  const now = Date.now();

  let oldestAge = 0;
  let oldestTimestamp: string | null = null;
  let hasStale = false;

  for (const item of queue) {
    const itemTime = new Date(item.timestamp).getTime();
    if (!isNaN(itemTime)) {
      const age = now - itemTime;
      if (age > oldestAge) {
        oldestAge = age;
        oldestTimestamp = item.timestamp;
      }
      // بررسی سقف ماندگاری بیش از ۱۰ دقیقه (۶۰۰،۰۰۰ میلی‌ثانیه)
      if (age > 10 * 60 * 1000) {
        hasStale = true;
      }
    }
  }

  const staleWarningMessage = hasStale
    ? "هشدار: برخی اقدامات بیش از ۱۰ دقیقه است که در صف آفلاین مانده‌اند و به سرور دپو ارسال نشده‌اند. لطفاً اتصال شبکه یا مجوزهای پوشه اشتراکی را بررسی کنید."
    : null;

  return {
    queueLength: queue.length,
    hasStaleItems: hasStale,
    staleWarningMessage,
    oldestItemAgeMs: oldestAge,
    oldestItemTimestamp: oldestTimestamp,
    policy,
    isSyncing: globalIsSyncing,
    lastSyncAttempt: globalLastSyncAttempt,
  };
}

/**
 * راه‌اندازی ورکر پس‌زمینه جهت تلاش خودکار هر ۳۰ ثانیه برای تخلیه صف آفلاین به سرور
 */
export function startOfflineSyncBackgroundWorker(): void {
  if (syncIntervalHandle) return;

  if (typeof setInterval !== "undefined") {
    syncIntervalHandle = setInterval(async () => {
      try {
        const netStatus = await getNetworkStatus();
        if (netStatus.isShared && netStatus.isDatabaseReady) {
          const queue = await getOfflineQueue();
          if (queue.length > 0) {
            console.log(`[OfflineSyncWorker] تلاش خودکار دوره‌ای (۳۰ ثانیه) برای همگام‌سازی ${queue.length} رکورد آفلاین...`);
            await syncOfflineActionsToServer();
          }
        }
      } catch (err) {
        console.error("[OfflineSyncWorker] خطا در چرخه زمان‌بندی همگام‌سازی:", err);
      }
    }, 30 * 1000); // دقیقاً ۳۰ ثانیه طبق دستور کارفرما

    if (syncIntervalHandle.unref) {
      syncIntervalHandle.unref();
    }
  }
}

// فعال‌سازی خودکار ورکر پس‌زمینه در محیط‌های سرور
if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
  startOfflineSyncBackgroundWorker();
}


/**
 * ذخیره لیست صف رکوردهای آفلاین
 */
async function saveOfflineQueue(queue: OfflineAction[]): Promise<void> {
  const serialized = JSON.stringify(queue);

  // ۱. ذخیره در دیتابیس
  try {
    await prisma.appSetting.upsert({
      where: { scope_userId_key: { scope: "global", userId: 0, key: OFFLINE_QUEUE_KEY } },
      create: { scope: "global", userId: 0, key: OFFLINE_QUEUE_KEY, value: serialized },
      update: { value: serialized },
    });
  } catch {}

  // ۲. ذخیره در فایل محلی دیسک به عنوان نسخه پشتیبان
  try {
    const filePath = getLocalQueueFilePath();
    fs.writeFileSync(filePath, serialized, "utf8");
  } catch {}
}

/**
 * ثبت یک عملیات جدید در صف آفلاین
 */
export async function recordOfflineAction(
  action: Omit<OfflineAction, "id" | "timestamp"> & { timestamp?: string }
): Promise<OfflineAction> {
  const newAction: OfflineAction = {
    id: crypto.randomUUID ? crypto.randomUUID() : `offline_${Date.now()}_${Math.random()}`,
    actionType: action.actionType,
    data: action.data,
    timestamp: action.timestamp || new Date().toISOString(),
    userId: action.userId ?? null,
    userFullName: action.userFullName ?? "کاربر سیستم",
  };

  const currentQueue = await getOfflineQueue();
  currentQueue.push(newAction);
  await saveOfflineQueue(currentQueue);

  console.log(
    `[OfflineSync] اکشن آفلاین با موفقیت ثبت شد: ${newAction.actionType} (زمان: ${newAction.timestamp})`
  );

  return newAction;
}

/**
 * اجرای همگام‌سازی هوشمند تغییرات آفلاین با پایگاه داده متمرکز سرور دپو
 * با اولویت‌بندی اکید زمانی (Chronological Timestamp Ordering)
 */
export async function syncOfflineActionsToServer(): Promise<{
  success: boolean;
  syncedCount: number;
  message: string;
}> {
  globalIsSyncing = true;
  globalLastSyncAttempt = new Date().toISOString();

  try {
    // ۱. بررسی وضعیت اتصال به سرور دپو
    const netStatus = await getNetworkStatus();
    if (!netStatus.isShared || !netStatus.isDatabaseReady) {
      return {
        success: false,
        syncedCount: 0,
        message: "ارتباط با سرور متمرکز دپو برقرار نیست؛ همگام‌سازی به تعویق افتاد.",
      };
    }

    // ۲. دریافت صف اقدامات معوق
    const queue = await getOfflineQueue();
    if (queue.length === 0) {
      return {
        success: true,
        syncedCount: 0,
        message: "هیچ داده آفلاینی برای همگام‌سازی وجود ندارد.",
      };
    }

    // ۳. مرتب‌سازی زمانی اکید (Chronological Ordering)
    // در صورتی که چندین کاربر هم‌زمان در زمان قطعی تغییراتی ثبت کرده باشند،
    // تغییرات دقیقاً بر اساس ساعت و دقیقه ثبت (timestamp) اعمال می‌شوند تا تداخل‌ها به درستی حل شوند.
    const sortedQueue = [...queue].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    });

    console.log(`[OfflineSync] در حال پردازش و همگام‌سازی ${sortedQueue.length} اکشن آفلاین بر اساس ساعت ثبت...`);

    let appliedCount = 0;
    const failedActions: OfflineAction[] = [];

    for (const item of sortedQueue) {
      try {
        const originalTime = new Date(item.timestamp);
        const actorSession = item.userId
          ? {
              id: item.userId,
              userName: item.userFullName || "کاربر آفلاین",
              fullName: item.userFullName || "کاربر آفلاین",
              role: 2,
            }
          : null;

        switch (item.actionType) {
          case "CREATE_MANOVR": {
            const mData = item.data;
            // جلوگیری از درج تکراری با بررسی تطابق قطار، مبدا، مقصد و زمان ثبت
            const existing = await prisma.manovr.findFirst({
              where: {
                trainId: mData.trainId,
                sourceLineId: mData.sourceLineId,
                destinationLineId: mData.destinationLineId,
                createdAt: {
                  gte: new Date(originalTime.getTime() - 2000),
                  lte: new Date(originalTime.getTime() + 2000),
                },
              },
            });

            if (!existing) {
              const desc = mData.description
                ? `${mData.description} (همگام‌سازی شده از حالت آفلاین)`
                : "ثبت شده در حالت آفلاین و همگام‌سازی شده خودکار با سرور";

              const createdManovr = await prisma.manovr.create({
                data: {
                  type: mData.type || 2,
                  trainId: mData.trainId,
                  sourceLineId: mData.sourceLineId,
                  destinationLineId: mData.destinationLineId,
                  rahbar1Id: mData.rahbar1Id,
                  rahbar2Id: mData.rahbar2Id || null,
                  creatorId: mData.creatorId || item.userId || null,
                  description: desc,
                  status: mData.status || 1,
                  executionTime: mData.executionTime ? new Date(mData.executionTime) : originalTime,
                  createdAt: originalTime, // حفظ دقیق ساعت ثبت آفلاین
                },
              });

              // در صورتی که مانور از نوع جابجایی قطار باشد، خط قطار نیز در سرور آپدیت شود
              if (mData.destinationLineId) {
                await prisma.train.update({
                  where: { id: mData.trainId },
                  data: {
                    lineId: mData.destinationLineId,
                    slotIndex: mData.slotIndex || 0,
                  },
                });
              }

              await audit(
                actorSession,
                "manovr",
                createdManovr.id,
                "CREATE",
                null,
                createdManovr,
                `مانور آفلاین ثبت‌شده در ساعت ${item.timestamp} توسط ${item.userFullName || "کاربر"} با موفقیت در سرور ثبت شد.`
              );
            }
            appliedCount++;
            break;
          }

          case "RELOCATE_TRAIN": {
            const rData = item.data;
            const before = await prisma.train.findUnique({ where: { id: rData.trainId } });
            const after = await prisma.train.update({
              where: { id: rData.trainId },
              data: {
                lineId: rData.destinationLineId,
                slotIndex: rData.slotIndex || 0,
              },
            });
            await audit(
              actorSession,
              "train",
              rData.trainId,
              "UPDATE",
              before,
              after,
              `جابجایی آفلاین قطار ${before?.code} به خط ${rData.destinationLineId} در سرور ثبت شد.`
            );
            appliedCount++;
            break;
          }

          case "UPDATE_TRAIN_STATUS": {
            const sData = item.data;
            const before = await prisma.train.findUnique({ where: { id: sData.trainId } });
            const after = await prisma.train.update({
              where: { id: sData.trainId },
              data: {
                status: sData.status,
              },
            });
            await audit(
              actorSession,
              "train",
              sData.trainId,
              "UPDATE",
              before,
              after,
              `تغییر وضعیت فنی آفلاین قطار ${before?.code} در سرور ثبت شد.`
            );
            appliedCount++;
            break;
          }

          case "UPDATE_TRAIN_FLAGS": {
            const fData = item.data;
            const before = await prisma.train.findUnique({ where: { id: fData.trainId } });
            const after = await prisma.train.update({
              where: { id: fData.trainId },
              data: {
                ...(fData.hasKafshak !== undefined && { hasKafshak: fData.hasKafshak }),
                ...(fData.noAtp !== undefined && { noAtp: fData.noAtp }),
                ...(fData.movadDavvar !== undefined && { movadDavvar: fData.movadDavvar }),
                ...(fData.noLicense !== undefined && { noLicense: fData.noLicense }),
              },
            });
            await audit(
              actorSession,
              "train",
              fData.trainId,
              "UPDATE",
              before,
              after,
              `بروزرسانی نشانگرهای فنی آفلاین قطار ${before?.code} در سرور ثبت شد.`
            );
            appliedCount++;
            break;
          }

          default:
            break;
        }
      } catch (err: any) {
        console.error(`[OfflineSync] خطا در همگام‌سازی اکشن ${item.id}:`, err);
        failedActions.push(item);
      }
    }

    // ۴. به‌روزرسانی صف با مواردی که با خطا مواجه شدند (در صورت وجود)
    await saveOfflineQueue(failedActions);

    // ۵. ارسال رویداد زنده SSE به تمامی کلاینت‌های شبکه تا نمای دپو فوراً به‌روز شود
    try {
      emitSSEEvent("manovr_changed", { syncedCount: appliedCount });
      emitSSEEvent("train_changed", { syncedCount: appliedCount });
    } catch {}

    const successMessage = `${appliedCount} مورد ثبت‌شده در حالت آفلاین، بر اساس ساعت و دقیقه ثبت با موفقیت با سرور متمرکز دپو همگام‌سازی شد.`;
    console.log(`[OfflineSync] نتیجه: ${successMessage}`);

    return {
      success: true,
      syncedCount: appliedCount,
      message: successMessage,
    };
  } finally {
    globalIsSyncing = false;
  }
}

