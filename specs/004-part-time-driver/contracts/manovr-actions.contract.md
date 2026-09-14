# قراردادهای رابط مانور و گزارش‌دهی: راهبر غیردائم (Manovr & Reports Contract)

**شاخه ویژگی**: `004-part-time-driver`  
**تاریخ**: ۲۵ شهریور ۱۴۰۵ (2026-09-15)  

---

## ۱. قرارداد واکشی راهبران در فرم‌ها (`getAvailableDrivers`)

### خروجی لیست راهبران
```typescript
interface DriverOptionItem {
  id: number;
  name: string; // نام و نام خانوادگی، با برچسب اختیاری " (راهبر غیردائم)"
  orgPosition: number;
  isPartTimeDriver: boolean;
  shift: number;
}
```

### قانون کوئری در لایه دیتابیس
```typescript
const drivers = await prisma.personnel.findMany({
  where: {
    OR: [
      { orgPosition: 1 },
      { isPartTimeDriver: true }
    ]
  },
  select: {
    id: true,
    firstName: true,
    lastName: true,
    orgPosition: true,
    isPartTimeDriver: true,
    shift: true,
  },
  orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
});
```

---

## ۲. قرارداد موتور گزارش‌دهی (`getDriverShuntingReport`)

### پارامترهای فیلتر (`DriverReportFilterParams`)
```typescript
export interface DriverReportFilterParams {
  fromDate?: string;
  toDate?: string;
  driverId?: number | null; // می‌تواند شناسه راهبر دائم یا راهبر غیردائم باشد
  shift?: number | null;
  soloOnly?: boolean;
}
```

### ساختار خلاصه عملکرد راهبر (`DriverShiftSummary`)
```typescript
export interface DriverShiftSummary {
  driverId: number;
  driverName: string;
  isPartTimeDriver: boolean; // نشانگر وضعیت غیردائم در جدول گزارش
  totalShunts: number;
  soloShunts: number;
  assistedShunts: number;
  shiftA: number;
  shiftB: number;
  shiftC: number;
  shiftD: number;
  soloPercentage: number;
}
```

### قوانین محاسباتی:
- تمامی رکوردهای جدول `Manovr` که `rahbar1Id` برابر با کاربر مورد نظر باشد محاسبه می‌شوند.
- در خروجی‌های اکسل و جدول فرانت‌اند، این افراد دارای نشانگر بصری مشخص هستند.
