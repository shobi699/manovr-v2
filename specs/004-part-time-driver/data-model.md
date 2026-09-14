# مستند مدل داده و تغییرات پایگاه‌داده: راهبر غیردائم (Phase 1 Data Model)

**شاخه ویژگی**: `004-part-time-driver`  
**تاریخ**: ۲۵ شهریور ۱۴۰۵ (2026-09-15)  

---

## ۱. شمای موجودیت `Personnel` (پایگاه‌داده Prisma)

تغییرات مورد نیاز در فایل `prisma/schema.prisma` روی مدل `Personnel`:

```prisma
model Personnel {
  id               Int          @id @default(autoincrement())
  firstName        String
  lastName         String
  userName         String?      @unique
  passwordHash     String?
  role             Int          @default(0) // 0 بدون‌دسترسی، 1 ادمین، 2 مسئول، 3 مشاهده
  shift            Int          @default(1) // 1=A 2=B 3=C 4=D
  orgPosition      Int          @default(1) // 1 راهبر، 2 مسئول، 3 ادمین، 4 سایر، 5 تکنسین، 6 مدیر، 7 رییس
  workPlace        Int          @default(1)
  personnelType    Int          @default(1) // 1 = مانور، 2 = پایانه
  personnelCode    String?      @unique
  hasAccount       Boolean      @default(false)
  createdAt        DateTime     @default(now())

  // فیلد جدید این ویژگی:
  isPartTimeDriver Boolean      @default(false) // نشانگر صلاحیت راهبری غیردائم برای پرسنل غیرراهبر

  // دفترچه تلفن
  phone1           String?
  phone2           String?
  internalTel      String?
  address          String?
  avatarColor      String?

  // نقش سفارشی
  accessRoleId     Int?
  accessRole       AccessRole?  @relation(fields: [accessRoleId], references: [id])

  // ارتباطات با مانورها (بدون نیاز به تغییر)
  manovrsAsRahbar1 Manovr[]     @relation("Rahbar1")
  manovrsAsRahbar2 Manovr[]     @relation("Rahbar2")
  manovrsCreated   Manovr[]     @relation("Creator")

  // سایر ارتباطات دست‌نخورده باقی می‌مانند
  settings         AppSetting[]
  savedReports     SavedReport[]
  notifications    Notification[]
  tickets          Ticket[]     @relation("Creator")
  ticketsAssigned  Ticket[]     @relation("Assignee")
  historyFrom      TicketHistory[] @relation("HistoryFrom")
  historyTo        TicketHistory[] @relation("HistoryTo")

  @@index([role])
  @@index([shift])
  @@index([orgPosition])
  @@index([isPartTimeDriver])
}
```

---

## ۲. قوانین اعتبارسنجی اسکیما (Zod Runtime Validation)

در فایل `src/lib/validations/user.schema.ts`:

```typescript
// اعتبارسنجی فیلد در اسکیماهای ایجاد و ویرایش کاربر:
export const createUserSchema = z.object({
  firstName: requiredString("نام"),
  lastName: requiredString("نام خانوادگی"),
  userName: optionalString,
  password: z.string().optional().nullable().transform((v) => (v ? v.trim() : "")),
  role: numberWithDefault(0, 0, 10).optional(),
  shift: numberWithDefault(1, 1, 99),
  orgPosition: numberWithDefault(4, 1, 999),
  isPartTimeDriver: booleanWithDefault(false), // فیلد جدید
  personnelType: numberWithDefault(1, 1, 10),
  personnelCode: optionalString,
  hasAccount: booleanWithDefault(false),
  accessRoleId: optionalNumber,
  phone1: optionalString,
  phone2: optionalString,
  internalTel: optionalString,
  address: optionalString,
  avatarColor: optionalString,
}).superRefine((data, ctx) => {
  // اگر کاربر راهبر اصلی است، isPartTimeDriver نباید true باشد (اصلاح خودکار در لایه سرور)
});

export const updateUserSchema = z.object({
  id: requiredNumber("شناسه کاربر", 1),
  firstName: requiredString("نام"),
  lastName: requiredString("نام خانوادگی"),
  userName: optionalString,
  role: numberWithDefault(0, 0, 10).optional(),
  shift: numberWithDefault(1, 1, 99),
  orgPosition: numberWithDefault(4, 1, 999),
  isPartTimeDriver: booleanWithDefault(false), // فیلد جدید
  personnelType: numberWithDefault(1, 1, 10),
  personnelCode: optionalString,
  hasAccount: booleanWithDefault(false),
  accessRoleId: optionalNumber,
  phone1: optionalString,
  phone2: optionalString,
  internalTel: optionalString,
  address: optionalString,
  avatarColor: optionalString,
});
```

---

## ۳. گذارهای وضعیت و منطق کسب‌وکار (State Transitions & Rules)

| وضعیت فعلی کاربر | اقدام مدیر / سیستم | وضعیت جدید `orgPosition` | وضعیت جدید `isPartTimeDriver` | نتیجه عملیاتی |
|-------------------|-------------------|--------------------------|-------------------------------|----------------|
| تکنسین / مسئول (`orgPosition !== 1`) | تیک زدن «راهبر غیردائم» و ذخیره | بدون تغییر (همان سمت اصلی) | `true` | کاربر در دراپ‌داون‌های ثبت مانور ظاهر می‌شود |
| راهبر غیردائم (`isPartTimeDriver: true`) | برداشتن تیک «راهبر غیردائم» و ذخیره | بدون تغییر | `false` | کاربر از دراپ‌داون ثبت مانورهای آینده خارج می‌شود؛ سوابق قبلی محفوظ می‌ماند |
| هر سمتی (`orgPosition !== 1`) | ارتقا یا تغییر سمت اصلی به «راهبر» (۱) | `1` («راهبر») | خودکار `false` می‌شود | کاربر به عنوان راهبر دائمی شناخته می‌شود و چک‌باکس غیرفعال می‌گردد |
| راهبر اصلی (`orgPosition === 1`) | تغییر سمت به غیرراهبر (مثلا تکنسین) | کد جدید (مثلا ۵) | پیش‌فرض `false` (مگر مدیر مجدداً تیک بزند) | رفتار مطابق سمت جدید تنظیم می‌شود |

---

## ۴. ایندکس‌ها و کارایی کوئری‌ها (Performance & Indexes)
- افزودن `@@index([isPartTimeDriver])` و `@@index([orgPosition])` در مدل `Personnel` جهت بهینه‌سازی سرعت کوئری‌های فیلتر تلفیقی `{ OR: [{ orgPosition: 1 }, { isPartTimeDriver: true }] }` در زمان‌های اوج ثبت مانور در پایانه.
