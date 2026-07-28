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
