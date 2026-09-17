"use server";

import {
  repairDatabaseInPlace,
  getNetworkStatus,
  RepairResult,
  NetworkStatusResult,
} from "@/lib/network-status";

/**
 * اجرای عملیات آزادسازی قفل و تعمیر پایگاه داده مستقیماً از داخل رابط کاربری نرم‌افزار
 */
export async function runDatabaseRepairAction(): Promise<RepairResult> {
  try {
    return await repairDatabaseInPlace();
  } catch (error: any) {
    return {
      success: false,
      message: "خطای پیش‌بینی‌نشده در اجرای فرآیند تعمیر پایگاه داده.",
      steps: [
        {
          title: "خطای سیستمی",
          status: "error",
          detail: error?.message || "خطای نامشخص",
        },
      ],
    };
  }
}

/**
 * دریافت گزارش کامل و ۵ مرحله‌ای وضعیت پایگاه داده و دسترسی شبکه
 */
export async function getDetailedDatabaseStatusAction(): Promise<NetworkStatusResult> {
  return await getNetworkStatus();
}
