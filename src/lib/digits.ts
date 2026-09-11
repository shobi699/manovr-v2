/**
 * تبدیل ارقام فارسی و عربی به ارقام انگلیسی
 */
export function toEnglishDigits(str: string): string {
  if (!str) return str;
  return str
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}
