# مدل داده و ساختار پیکربندی بسته و شبیه‌ساز شبکه (Data Model: 003-packaging-network-resilience)

**قابلیت**: بسته‌بندی توزیع، آزمون استرس همروندی دیتابیس و شبیه‌سازی شبکه با پینگ بالا  
**تاریخ**: ۱۴۰۵/۰۶/۲۵ (2026-09-15)  
**سند برنامه**: [plan.md](./plan.md)

---

## ۱. مدل داده شبیه‌ساز تاخیر شبکه (NetworkSimulationConfig)

```typescript
export interface NetworkSimulationConfig {
  sharedFolderPath: string;        // مسیر پوشه مجازی اشتراک شبکه
  simulatedMinPingMs: number;      // حداقل پینگ شبیه‌سازی‌شده (مثلاً ۱۰۰ms)
  simulatedMaxPingMs: number;      // حداکثر پینگ شبیه‌سازی‌شده (مثلاً ۸۰۰ms)
  jitterEnabled: boolean;          // اعمال لرزش تصادفی در تاخیر پینگ
  simulatedDropRate: number;       // نرخ تاخیر شدید شبیه‌سازی‌شده (بین ۰ تا ۱)
  concurrentClientsCount: number;  // تعداد کلاینت‌ها/کاربران همزمان (مثلاً ۱۰ کاربر)
  totalTransactionsPerClient: number; // تعداد عملیات به ازای هر کلاینت
}
```

---

## ۲. مدل داده نتایج آزمون استرس همروندی (StressTestResult)

```typescript
export interface StressTestResult {
  executionDate: string;           // تاریخ و زمان به افق تهران
  totalClients: number;            // تعداد کلاینت‌های موازی
  totalOperations: number;         // مجموع عملیات ارسال‌شده
  successfulOperations: number;    // عملیات موفق
  failedOperations: number;        // عملیات ناموفق
  retryCountTotal: number;         // تعداد بازتلاش‌های صف نوبت‌دهی
  averageLatencyMs: number;        // میانگین تاخیر تراکنش‌ها
  maxLatencyMs: number;            // بیشترین زمان انتظار
  busyLockErrors: number;          // تعداد خطاهای قفل (باید ۰ باشد)
  persistenceVerified: boolean;    // اثبات صحت داده‌ها در دیتابیس
  status: "PASSED" | "FAILED";
}
```

---

## ۳. مدل داده مانیفست بسته‌های توزیع نهایی (DistributionManifest)

```typescript
export interface DistributionArtifact {
  format: "PORTABLE" | "INSTALLER" | "UNPACKED_DIR" | "USER_GUIDE";
  fileName: string;
  relativePath: string;
  sizeBytes: number;
  sizeFormatted: string;
  sha256Hash?: string;
  verifiedExecutable: boolean;
}

export interface DistributionManifest {
  manifestId: string;
  productName: string;
  version: string;
  buildDateJalali: string;
  distributionDirectory: string;   // D:/manovr-build-dist
  artifacts: DistributionArtifact[];
  systemRequirements: {
    os: string;
    architecture: string;
    minRam: string;
    networkShareCompatible: boolean;
  };
}
```
