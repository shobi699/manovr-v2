# قراردادهای رابط اکشن‌های کاربری: راهبر غیردائم (User Actions Contract)

**شاخه ویژگی**: `004-part-time-driver`  
**تاریخ**: ۲۵ شهریور ۱۴۰۵ (2026-09-15)  

---

## ۱. اکشن `createUser`

### ورودی (`FormData` یا شیء ورودی)
```typescript
interface CreateUserInput {
  firstName: string;
  lastName: string;
  userName?: string | null;
  password?: string | null;
  role?: number;
  shift: number;
  orgPosition: number;
  isPartTimeDriver?: boolean; // مقدار جدید ارسالی از چک‌باکس فرم
  personnelType: number;
  personnelCode?: string | null;
  hasAccount: boolean;
  accessRoleId?: number | null;
  phone1?: string | null;
  phone2?: string | null;
  internalTel?: string | null;
  address?: string | null;
  avatarColor?: string | null;
}
```

### خروجی اکشن
```typescript
type CreateUserResponse =
  | { success: true; user: { id: number; name: string; isPartTimeDriver: boolean } }
  | { error: string };
```

### رفتارهای مورد انتظار:
- اگر `orgPosition === 1` باشد، مقدار `isPartTimeDriver` صرف‌نظر از ورودی به `false` تنظیم می‌شود.
- بررسی گارد دسترسی: `hasPerm(session, "user.create")`.
- ثبت لاگ ممیزی در صورت موفقیت با پیام متنی فارسی.

---

## ۲. اکشن `updateUser`

### ورودی
```typescript
interface UpdateUserInput {
  id: number;
  firstName: string;
  lastName: string;
  userName?: string | null;
  role?: number;
  shift: number;
  orgPosition: number;
  isPartTimeDriver?: boolean; // مقدار به‌روزرسانی‌شده
  personnelType: number;
  personnelCode?: string | null;
  hasAccount: boolean;
  accessRoleId?: number | null;
  phone1?: string | null;
  phone2?: string | null;
  internalTel?: string | null;
  address?: string | null;
  avatarColor?: string | null;
}
```

### خروجی اکشن
```typescript
type UpdateUserResponse =
  | { success: true; user: { id: number; name: string; isPartTimeDriver: boolean } }
  | { error: string };
```

### رفتارهای مورد انتظار:
- اگر `orgPosition === 1` باشد، مقدار `isPartTimeDriver` روی `false` ذخیره می‌شود.
- اگر کاربر قبلاً راهبر غیردائم بوده و اکنون تیک برداشته شده، مقدار در دیتابیس `false` می‌گردد بدون اینکه سوابق مانورهای قبلی حذف یا دچار نقص شود.
- گارد دسترسی: `hasPerm(session, "user.edit")`.
