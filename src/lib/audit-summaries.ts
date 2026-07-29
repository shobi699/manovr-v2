// سازنده‌های خلاصه فارسی برای لاگ وقایع مدیریت کاربران، نقش‌ها و خطوط.
// بدون وابستگی — تا هم در اکشن‌ها و هم در تست‌ها قابل استفاده باشند.

const fullName = (firstName?: string | null, lastName?: string | null) =>
  `${firstName ?? ""} ${lastName ?? ""}`.trim() || "بدون نام";

export function personnelCreatedSummary(p: { firstName?: string | null; lastName?: string | null; hasAccount?: boolean }) {
  return p.hasAccount
    ? `کاربر «${fullName(p.firstName, p.lastName)}» به همراه حساب کاربری ایجاد شد.`
    : `پرسنل «${fullName(p.firstName, p.lastName)}» بدون حساب کاربری ثبت شد.`;
}

export function personnelUpdatedSummary(p: { firstName?: string | null; lastName?: string | null }) {
  return `اطلاعات کاربر «${fullName(p.firstName, p.lastName)}» ویرایش شد.`;
}

export function personnelDeletedSummary(p: { firstName?: string | null; lastName?: string | null }) {
  return `کاربر «${fullName(p.firstName, p.lastName)}» از سامانه حذف شد.`;
}

// هرگز رمز عبور یا هش آن را در خلاصه قرار ندهید
export function passwordResetSummary(p: { firstName?: string | null; lastName?: string | null }) {
  return `رمز عبور کاربر «${fullName(p.firstName, p.lastName)}» توسط مدیر بازنشانی شد.`;
}

export function bulkPersonnelSummary(action: string, count: number, ids: number[]) {
  const shown = ids.slice(0, 20).join("، ");
  const more = ids.length > 20 ? ` و ${ids.length - 20} مورد دیگر` : "";
  return `${action} به صورت گروهی روی ${count} پرسنل انجام شد (شناسه‌ها: ${shown}${more}).`;
}

export function roleCreatedSummary(name: string, permCount: number) {
  return `نقش دسترسی «${name}» با ${permCount} مجوز ایجاد شد.`;
}

export function roleUpdatedSummary(name: string, permCount: number) {
  return `مجوزهای نقش دسترسی «${name}» ویرایش شد (${permCount} مجوز).`;
}

export function roleDeletedSummary(name: string) {
  return `نقش دسترسی «${name}» حذف شد.`;
}

export function lineCreatedSummary(name: string) {
  return `خط «${name}» ایجاد شد.`;
}

export function lineUpdatedSummary(name: string) {
  return `خط «${name}» ویرایش شد.`;
}

export function lineDeletedSummary(name: string) {
  return `خط «${name}» حذف شد.`;
}

export function importSummary(entityLabel: string, count: number) {
  return `${count} ${entityLabel} به صورت گروهی از فایل اکسل وارد سامانه شد.`;
}

export function trainSummary(action: string, code: string) {
  return `قطار «${code}» ${action} شد.`;
}

export function manovrCreatedSummary(code: string, typeLabel: string) {
  return `مانور «${typeLabel}» برای قطار «${code}» ثبت گردید.`;
}

export function manovrStatusSummary(id: number, statusLabel: string) {
  return `وضعیت مانور کد ${id} به «${statusLabel}» تغییر یافت.`;
}

export function lookupSummary(action: string, label: string) {
  return `مقدار لوکاپ «${label}» ${action} شد.`;
}

export function ticketSummary(action: string, subject: string) {
  return `تیکت «${subject}» ${action} شد.`;
}
