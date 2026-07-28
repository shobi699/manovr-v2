export async function register() {
  // شبیه‌ساز پس‌زمینه فقط در محیط Node.js اجرا می‌شود
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  }
}
