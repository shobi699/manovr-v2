import { z } from "zod";

/**
 * تبدیل خطاهای Zod به یک پیام متنی فارسی شفاف و روان برای کاربر
 */
export function formatZodError(error: z.ZodError): string {
  const issues = error.issues;
  if (!issues || issues.length === 0) {
    return "اطلاعات ارسالی نامعتبر است.";
  }
  return issues[0].message;
}

/**
 * رشته الزامی با خطای سفارشی فارسی
 */
export const requiredString = (fieldName: string, minLength = 1) =>
  z
    .string({
      error: `${fieldName} الزامی است.`,
    })
    .trim()
    .min(minLength, `${fieldName} الزامی است.`);

/**
 * رشته اختیاری (که رشته خالی را به null تبدیل می‌کند)
 */
export const optionalString = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((val) => (val && val.length > 0 ? val : null));

/**
 * عدد اجباری با تبدیل خودکار از رشته فرم
 */
export const requiredNumber = (fieldName: string, min?: number, max?: number) => {
  let schema = z.coerce.number({
    error: `${fieldName} الزامی است.`,
  });
  if (min !== undefined) {
    schema = schema.min(min, `${fieldName} نمی‌تواند کمتر از ${min} باشد.`);
  }
  if (max !== undefined) {
    schema = schema.max(max, `${fieldName} نمی‌تواند بیشتر از ${max} باشد.`);
  }
  return schema;
};

/**
 * عدد اختیاری با مقدار پیش‌فرض
 */
export const numberWithDefault = (defaultValue: number, min?: number, max?: number) => {
  let schema = z.coerce.number();
  if (min !== undefined) {
    schema = schema.min(min);
  }
  if (max !== undefined) {
    schema = schema.max(max);
  }
  return schema.default(defaultValue);
};

/**
 * عدد اختیاری که اگر ارسال نشود یا خالی باشد null برمی‌گرداند
 */
export const optionalNumber = z
  .preprocess(
    (val) => (val === "" || val === undefined || val === null ? null : val),
    z.coerce.number().nullable().optional()
  )
  .transform((val) => (val === undefined ? null : val));

/**
 * بولی منعطف مناسب فرم‌ها و داده‌های FormData
 */
export const booleanWithDefault = (defaultValue = false) =>
  z
    .preprocess((val) => {
      if (typeof val === "boolean") return val;
      if (val === "1" || val === "true" || val === 1) return true;
      if (val === "0" || val === "false" || val === 0) return false;
      if (val === undefined || val === null || val === "") return defaultValue;
      return Boolean(val);
    }, z.boolean())
    .default(defaultValue);
