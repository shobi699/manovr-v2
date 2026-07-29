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
