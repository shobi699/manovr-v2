import fs from "fs";
import path from "path";
// Trigger TS server reload
import { prisma } from "@/lib/prisma";
import { checkAndRunScheduledBackup } from "@/lib/backup";
import { executeReportQuery, type ReportConfig } from "@/lib/report-engine";
import { generateExcelBuffer, generatePDFBuffer } from "@/lib/export-helpers";
import { audit } from "@/lib/audit";
import { emitSSEEvent } from "@/lib/events";

const globalForScheduler = globalThis as unknown as {
  schedulerStarted: boolean | undefined;
};

// تابع کمکی برای مقایسه فیلدهای کرون
function matchCronField(cronField: string, currentVal: number): boolean {
  if (cronField === "*") return true;

  if (cronField.startsWith("*/")) {
    const step = parseInt(cronField.slice(2));
    return currentVal % step === 0;
  }

  if (cronField.includes(",")) {
    const parts = cronField.split(",").map((p) => parseInt(p));
    return parts.includes(currentVal);
  }

  if (cronField.includes("-")) {
    const [start, end] = cronField.split("-").map((p) => parseInt(p));
    return currentVal >= start && currentVal <= end;
  }

  return parseInt(cronField) === currentVal;
}

// بررسی تطابق عبارت کرون با زمان جاری سیستم به وقت تهران
export function cronMatch(cronExpr: string, date: Date): boolean {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length < 5) return false;

  const [minPattern, hourPattern, dayPattern, monthPattern, dayOfWeekPattern] = parts;

  // تبدیل تاریخ به منطقه زمانی تهران
  const tehranTime = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Tehran" }));

  const min = tehranTime.getMinutes();
  const hour = tehranTime.getHours();
  const day = tehranTime.getDate();
  const month = tehranTime.getMonth() + 1; // 1-12
  const dayOfWeek = tehranTime.getDay(); // 0-6 (0 = یکشنبه در JS، اما در کرون استاندارد 0 یا 7 = یکشنبه)

  return (
    matchCronField(minPattern, min) &&
    matchCronField(hourPattern, hour) &&
    matchCronField(dayPattern, day) &&
    matchCronField(monthPattern, month) &&
    matchCronField(dayOfWeekPattern, dayOfWeek)
  );
}

// اجرای فیزیکی گزارش و تولید فایل خروجی
async function runReportTask(sr: any) {
  try {
    const report = sr.savedReport;
    const config: ReportConfig = JSON.parse(report.config);
    
    // ۱. کوئری داده‌ها از دیتابیس
    const records = await executeReportQuery(config);
    
    // ۲. تولید بافر فایل بر اساس فرمت انتخابی
    let buffer: Uint8Array;
    const ext = sr.format === "pdf" ? "pdf" : "xlsx";
    
    if (sr.format === "pdf") {
      buffer = await generatePDFBuffer(config.entity, config.fields, records);
    } else {
      buffer = await generateExcelBuffer(config.entity, config.fields, records);
    }

    // ۳. ایجاد دایرکتوری و ذخیره فایل در مسیر خروجی محلی
    const outputDirectory = path.isAbsolute(sr.outputDir)
      ? sr.outputDir
      : path.join(process.cwd(), sr.outputDir);

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

    const summary = `گزارش دوره‌ای زمان‌بندی‌شده '${report.name}' با موفقیت تولید و در مسیر ${filePath} ذخیره شد.`;

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

  } catch (error: any) {
    console.error(`[Scheduler] Error running scheduled report ${sr.id}:`, error);
  }
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
          console.log(`[Scheduler] Match found! Running scheduled report: ${sr.savedReport.name} (Cron: ${sr.cron})`);
          // اجرای آسنکرون برای عدم بلاک شدن حلقه اصلی
          runReportTask(sr);
        }
      }
    } catch (err) {
      console.error("[Scheduler] Error in check loop:", err);
    }
  }, 60000);
}
