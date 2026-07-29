// قواعد دامنه‌ی مانور — بدون وابستگی به دیتابیس تا قابل تست باشند

/**
 * آیا خط مقصد ظرفیت پذیرش این قطار را دارد؟
 *
 * @param occupantCount تعداد قطارهای اسقاط‌نشده روی خط مقصد، بدون احتساب خود این قطار
 * @param capacity ظرفیت خط مقصد
 */
export function hasRoomOnLine(occupantCount: number, capacity: number): boolean {
  return occupantCount < capacity;
}

/**
 * مانور نوع ۲۰ (تعویض کفشک) پرچم کفشک قطار را فعال می‌کند
 */
export const KAFSHAK_MANOVR_TYPE = 20;

export function shouldSetKafshak(manovrType: number): boolean {
  return manovrType === KAFSHAK_MANOVR_TYPE;
}

/**
 * کدهای مانورهای انتقال دائم (خروج قطار از نقشه‌های پایانه)
 * ۲۱: انتقال دائم به سایر خطوط
 * ۲۲: انتقال دائم به واگن‌سازی
 * ۲۳: سایر انتقال‌های دائم
 */
export const PERMANENT_MANOVR_TYPES = [21, 22, 23, 24];

export function isPermanentTransfer(manovrType: number): boolean {
  return PERMANENT_MANOVR_TYPES.includes(manovrType);
}
