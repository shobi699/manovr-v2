import fs from "fs";
import path from "path";
// Trigger TS server reload
import { prisma } from "@/lib/prisma";
import { checkAndRunScheduledBackup } from "@/lib/backup";
import { executeReportQuery, sanitizeReportFields, type ReportConfig } from "@/lib/report-engine";
import { generateExcelBuffer, generatePDFBuffer } from "@/lib/export-helpers";
import { audit } from "@/lib/audit";
import { emitSSEEvent } from "@/lib/events";
import { cronMatch } from "@/lib/cron";
import { resolveScheduledOutputDir, scheduledOutputRoot } from "@/lib/report-output";

import { reportQueue, type ReportJob } from "@/lib/report-queue";

export { cronMatch };

const globalForScheduler = globalThis as unknown as {
  schedulerStarted: boolean | undefined;
};

// تنظیم handler صف پس‌زمینه برای رندر گزارشات
reportQueue.setHandler(async (job: ReportJob) => {
  const sr = (job as any).srData;
  if (!sr) throw new Error("داده‌های رپورت زمان‌بندی شده نامعتبر است");
  return await executeScheduledReportJob(sr);
});

async function executeScheduledReportJob(sr: any): Promise<string> {
  const report = sr.savedReport;
  const config: ReportConfig = JSON.parse(report.config);
  
  // ۱. کوئری داده‌ها از دیتابیس
  const records = await executeReportQuery(config);
  
  // ۲. تولید بافر فایل بر اساس فرمت انتخابی
  let buffer: Uint8Array;
  const ext = sr.format === "pdf" ? "pdf" : "xlsx";
  const safeFields = sanitizeReportFields(config.entity, config.fields);
  
  if (sr.format === "pdf") {
    buffer = await generatePDFBuffer(config.entity, safeFields, records);
  } else {
    buffer = await generateExcelBuffer(config.entity, safeFields, records);
  }

  // ۳. ایجاد دایرکتوری و ذخیره فایل در مسیر خروجی محلی
  const outputDirectory = resolveScheduledOutputDir(sr.outputDir);
  if (!outputDirectory) {
    throw new Error(`[Scheduler] Refusing to run schedule ${sr.id}: output path is outside the allowed root.`);
  }

  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `report-${report.id}-${timestamp}.${ext}`;
  const filePath = path.join(outputDirectory, fileName);
  
  fs.writeFileSync(filePath, buffer);
  console.log(`[Scheduler] Report file successfully saved at: ${filePath}`);

  // ۴. بروزرسانی آخرین زمان اجرا در دیتابیس
  await prisma.scheduledReport.update({
    where: { id: sr.id },
    data: { lastRunAt: new Date() },
  });

  // ۵. ارسال نوتیفیکیشن سیستم به دریافت‌کنندگان
  const recipientIds = sr.recipients
    .split(",")
    .map((id: string) => parseInt(id.trim()))
    .filter((id: number) => !isNaN(id));

  const relativePath = path.relative(scheduledOutputRoot(), filePath);
  const summary = `گزارش دوره‌ای زمان‌بندی‌شده '${report.name}' با موفقیت تولید و در مسیر ${relativePath} ذخیره شد.`;

  for (const userId of recipientIds) {
    const notif = await prisma.notification.create({
      data: {
        userId,
        kind: "success",
        title: `گزارش دوره‌ای: ${report.name}`,
        body: summary,
        link: `/reports`,
      },
    });

    // ارسال سیگنال زنده SSE
    emitSSEEvent(`notification:${userId}`, {
      type: "new_notification",
      notification: notif,
    });
  }

  // ۶. ثبت لاگ امنیتی/سیستم
  await audit(
    null, // سیستم به عنوان عامل
    "scheduledReport",
    sr.id,
    "CONFIRM",
    null,
    { file: fileName, size: buffer.length },
    `سیستم به صورت خودکار گزارش '${report.name}' را با موفقیت اجرا و خروجی را ذخیره کرد.`
  );

  return filePath;
}

// شروع حلقه زمان‌بندی بررسی گزارشات
export function startScheduler() {
  if (globalForScheduler.schedulerStarted) {
    return;
  }

  globalForScheduler.schedulerStarted = true;
  console.log("[Scheduler] Offline background scheduler initialized and started.");

  // بررسی هر ۶۰ ثانیه یک بار
  setInterval(async () => {
    try {
      const now = new Date();
      
      // بررسی بکاپ‌های زمان‌بندی‌شده
      checkAndRunScheduledBackup().catch((e) => console.error("[Scheduler] Backup error:", e));
      
      // دریافت تمام برنامه‌های فعال
      const activeSchedules = await prisma.scheduledReport.findMany({
        where: { isActive: true },
        include: { savedReport: true },
      });

      for (const sr of activeSchedules) {
        if (cronMatch(sr.cron, now)) {
          // قفل اتمیک در دیتابیس مشترک شبکه: فقط کلاینتی که بتواند lastRunAt را رزرو کند مجاز به اجرای گزارش است
          const lockThreshold = new Date(now.getTime() - 55000);
          const claim = await prisma.scheduledReport.updateMany({
            where: {
              id: sr.id,
              isActive: true,
              OR: [
                { lastRunAt: null },
                { lastRunAt: { lt: lockThreshold } }
              ]
            },
            data: { lastRunAt: now },
          });

          if (claim.count === 0) {
            // گزارش قبلاً توسط سیستم دیگری در شبکه اجرا شده است
            continue;
          }

          console.log(`[Scheduler] Network lock acquired for report: ${sr.savedReport.name} (Cron: ${sr.cron})`);
          let entityName = "manovr";
          try {
            const parsedConfig = JSON.parse(sr.savedReport.config);
            entityName = parsedConfig.entity || "manovr";
          } catch {}
          // افزودن گزارش به صف آسنکرون پس‌زمینه برای عدم بلاک شدن ترد اصلی
          const job = reportQueue.enqueue(sr.savedReport.id, sr.savedReport.name, entityName, sr.format as any);
          (job as any).srData = sr;
        }
      }
    } catch (err) {
      console.error("[Scheduler] Error in check loop:", err);
    }
  }, 60000);
}
