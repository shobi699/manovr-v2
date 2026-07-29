// اعتبارسنجی مقادیر برندینگ پیش از تزریق در CSS و DOM.
// این مقادیر توسط دارنده مجوز branding.manage تعیین می‌شوند و در تمام صفحات
// برای همه کاربران رندر می‌شوند؛ بنابراین باید در هر دو مرز خواندن و نوشتن
// اعتبارسنجی شوند.

export const DEFAULT_ACCENT_COLOR = "#d8842a";

// دقیقاً شش رقم هگز با # — چون کد رندر دو رقم شفافیت به انتهای آن اضافه می‌کند
const HEX6 = /^#[0-9a-fA-F]{6}$/;

export function isValidAccentColor(value: unknown): value is string {
  return typeof value === "string" && HEX6.test(value);
}

export function safeAccentColor(value: unknown): string {
  return isValidAccentColor(value) ? value : DEFAULT_ACCENT_COLOR;
}

// فقط data URL تصویری یا مسیر نسبی هم‌ریشه پذیرفته می‌شود
const DATA_IMAGE = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
const RELATIVE_PATH = /^\/[A-Za-z0-9._\-/]*$/;

export function safeLogoImage(value: unknown): string {
  if (typeof value !== "string" || value === "") return "";
  if (DATA_IMAGE.test(value)) return value;
  if (RELATIVE_PATH.test(value)) return value;
  return "";
}

// متن‌های ساده — فقط محدودیت طول؛ React خودش escape می‌کند
export function safeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.slice(0, maxLength);
}
