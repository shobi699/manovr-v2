export async function register() {
  // زمان‌بند پس‌زمینه فقط در محیط Node.js و روی سرور اصلی اجرا می‌شود
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const isMaster = process.env.IS_MASTER_SERVER === "true" || process.env.NODE_ENV !== "production";
    if (isMaster) {
      const { startScheduler } = await import("@/lib/scheduler");
      startScheduler();
    }
  }
}
