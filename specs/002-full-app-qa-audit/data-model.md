# مدل داده و ساختار موجودیت‌های ممیزی کیفیت (Data Model: full-app-qa-audit)

**قابلیت**: ممیزی جامع کیفیت، لایه‌های سامانه و تست سرتاسری منوها  
**تاریخ**: ۱۴۰۵/۰۶/۲۵ (2026-09-15)  
**سند برنامه**: [plan.md](./plan.md)

---

## ۱. مدل داده رکورد ارزیابی منو (MenuAuditItem)

موجودیت نماینده نتایج ممیزی هر یک از ۲۰ منوی عملیاتی سامانه:

```typescript
export type AuditStatus = "PASS" | "WARN" | "FAIL" | "SKIP";

export interface MenuAuditItem {
  id: string;                      // شناسه یکتای منو، مثلا "depot"
  title: string;                   // عنوان فارسی منو، مثلا "نمای پایانه"
  route: string;                   // مسیر صفحه در برنامه، مثلا "/depot"
  requiredPerm?: string;           // کلید مجوز مورد نیاز در perms.ts
  
  // ۱. ارزیابی رابط کاربری (UI)
  uiAudit: {
    status: AuditStatus;
    rtlCompliant: boolean;         // رعایت dir="rtl" و کلاس‌های منطقی ms/me
    vazirmatnTypography: boolean;  // تایپوگرافی وزیرمتن و اعداد فارسی
    interactiveFeedback: boolean;  // بازخورد تعاملی دکمه‌ها و فرم‌ها
    noVisualOverlap: boolean;      // عدم شکستگی چیدمان
    details?: string;
  };

  // ۲. ارزیابی منطق سرور (Backend)
  backendAudit: {
    status: AuditStatus;
    actionTested: string;          // اکشن‌های سرور تست‌شده
    zodValidationActive: boolean;  // اعتبارسنجی با اسکیماهای Zod
    errorHandlingRobust: boolean;  // مهار استثناها بدون خطای ۵۰۰
    permissionGuarded: boolean;    // اعمال گارد hasPerm
    details?: string;
  };

  // ۳. ارزیابی اتصال پایگاه داده (Database)
  dbAudit: {
    status: AuditStatus;
    connectivityVerified: boolean; // اتصال پایدار به کلاینت دیتابیس
    persistenceProven: boolean;    // اثبات ذخیره‌سازی داده (Persistence Proof)
    walModeActive: boolean;        // فعال بودن حالت نوشتن همزمان بدون قفل
    details?: string;
  };

  // ۴. ارزیابی سبکی و کارایی (Lightness & Performance)
  performanceAudit: {
    status: AuditStatus;
    loadTimeMs: number;            // زمان بارگذاری صفحه (میلی‌ثانیه)
    renderLatencyMs: number;       // تاخیر رندر المان‌ها و جداول
    resourceLightness: "EXCELLENT" | "GOOD" | "MODERATE" | "HEAVY";
    details?: string;
  };

  overallStatus: AuditStatus;
  notes?: string;
}
```

---

## ۲. مدل داده ارزیابی لایه‌های معماری (SystemLayerCheck)

موجودیت نماینده وضعیت یکپارچگی لایه‌های مختلف نرم‌افزار:

```typescript
export interface SystemLayerCheck {
  layerName: "UI_PRESENTATION" | "SERVER_ACTIONS" | "DATABASE_PERSISTENCE" | "SECURITY_PERMS" | "EXPORT_SERVICES";
  descriptionFa: string;
  status: AuditStatus;
  componentsEvaluated: string[];
  assertionsChecked: number;
  assertionsPassed: number;
  findings: string[];
}
```

---

## ۳. مدل داده گزارش نهایی ممیزی کیفیت (ComprehensiveReport)

موجودیت سند نهایی گزارش ممیزی جهت ارائه به ذی‌نفعان و ثبت در سیستم:

```typescript
export interface ComprehensiveReport {
  reportId: string;                // شناسه یکتا با فرمت QA-YYYYMMDD-###
  reportDateJalali: string;        // تاریخ صدور به وقت تهران و تقویم جلالی
  auditorRole: string;             // کارشناس ارشد تضمین کیفیت
  targetEnvironment: string;       // محیط آزمون (Local Runtime / Dev Server)
  
  // آمار خلاصه
  summary: {
    totalMenusAudited: number;     // مجموع منوهای ارزیابی‌شده (۲۰ منو)
    passedMenus: number;           // منوهای با موفقیت کامل
    warningMenus: number;          // منوهای با هشدار غیرمسدودکننده
    failedMenus: number;           // منوهای با شکست
    averageLoadTimeMs: number;     // میانگین زمان لود
    systemLightnessRating: string; // ارزیابی کلی سبکی سیستم
  };

  menuDetails: MenuAuditItem[];
  layerDetails: SystemLayerCheck[];
  diagnosticObservations: string[];
  recommendations: string[];
  finalVerdict: "SYSTEM_APPROVED" | "ACTION_REQUIRED" | "CRITICAL_DEFECTS";
}
```
