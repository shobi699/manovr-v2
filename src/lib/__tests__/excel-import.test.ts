import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    personnel: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    accessRole: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/audit", () => ({
  audit: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: any) => fn,
}));

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  preValidatePersonnelImport,
  executePersonnelImportBatch,
} from "@/app/actions/excel-import";

function mockAdminSession() {
  vi.mocked(getSession).mockResolvedValue({
    id: 1,
    role: 1,
    userName: "admin",
    fullName: "مدیر سامانه",
    perms: ["user.create", "report.import", "phonebook.edit"],
  } as any);

  vi.mocked(prisma.personnel.findUnique).mockResolvedValue({
    id: 1,
    role: 1,
    orgPosition: 3,
  } as any);
}

describe("Excel Pre-Import Validation Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails when caller is unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await preValidatePersonnelImport([
      { rowIndex: 2, firstName: "علی", lastName: "رضایی" },
    ]);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("دسترسی ندارید");
  });

  it("identifies brand-new records with zero conflicts in a single bulk query", async () => {
    mockAdminSession();
    // هیچ رکوردی در دیتابیس با این مشخصات وجود ندارد
    vi.mocked(prisma.personnel.findMany).mockResolvedValue([]);

    const res = await preValidatePersonnelImport([
      {
        rowIndex: 2,
        firstName: "مهدی",
        lastName: "فردوسی",
        personnelCode: "99546",
        userName: "m_ferdowsi",
        phone1: "09121112233",
      },
      {
        rowIndex: 3,
        firstName: "احمد",
        lastName: "صبحی",
        personnelCode: "11223",
        userName: "a_sobhi",
        phone1: "09124445566",
      },
    ]);

    expect(res.ok).toBe(true);
    expect(res.totalRows).toBe(2);
    expect(res.nonConflicting.length).toBe(2);
    expect(res.conflicts.length).toBe(0);
    // دقیقا یک بار کوئری findMany برای تمام رکوردها
    expect(prisma.personnel.findMany).toHaveBeenCalledTimes(1);
  });

  it("detects conflict on matching personnelCode and provides comparison data", async () => {
    mockAdminSession();
    vi.mocked(prisma.personnel.findMany).mockResolvedValue([
      {
        id: 101,
        firstName: "مهدی",
        lastName: "قدیمی",
        personnelCode: "99546",
        userName: "old_user",
        phone1: "09120000000",
        phone2: null,
        internalTel: null,
        address: null,
        shift: 1,
        orgPosition: 1,
        hasAccount: true,
        role: 1,
        accessRoleId: 1,
      },
    ] as any);

    const res = await preValidatePersonnelImport([
      {
        rowIndex: 5,
        firstName: "مهدی",
        lastName: "جدید",
        personnelCode: "99546",
        phone1: "09129999999",
      },
    ]);

    expect(res.ok).toBe(true);
    expect(res.conflicts.length).toBe(1);
    expect(res.nonConflicting.length).toBe(0);
    expect(res.conflicts[0].matchType).toBe("personnelCode");
    expect(res.conflicts[0].matchValue).toBe("99546");
    expect(res.conflicts[0].existingRecord.id).toBe(101);
    expect(res.conflicts[0].conflictReason).toContain("کد پرسنلی");
  });

  it("detects conflict on matching userName and normalizes Persian digits", async () => {
    mockAdminSession();
    vi.mocked(prisma.personnel.findMany).mockResolvedValue([
      {
        id: 202,
        firstName: "سارا",
        lastName: "نوری",
        personnelCode: "12345",
        userName: "sara_n",
        phone1: "09191234567",
        phone2: null,
        internalTel: null,
        address: null,
        shift: 2,
        orgPosition: 4,
        hasAccount: true,
        role: 3,
        accessRoleId: 3,
      },
    ] as any);

    // ارسال با ارقام فارسی
    const res = await preValidatePersonnelImport([
      {
        rowIndex: 8,
        firstName: "سارا",
        lastName: "نوری راد",
        personnelCode: "۵۴۳۲۱", // کد متفاوت با ارقام فارسی
        userName: "sara_n",     // نام کاربری منطبق
        phone1: "۰۹۱۹۱۲۳۴۵۶۷",   // تلفن منطبق
      },
    ]);

    expect(res.ok).toBe(true);
    expect(res.conflicts.length).toBe(1);
    expect(res.conflicts[0].matchType).toBe("userName");
    expect(res.conflicts[0].newRecord.personnelCode).toBe("54321"); // ارقام انگلیسی شده
  });
});

describe("Batch Import & Upsert with Transaction Atomicity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes new records, updates approved conflicts, and skips unapproved ones inside a transaction", async () => {
    mockAdminSession();

    vi.mocked(prisma.accessRole.findFirst).mockResolvedValue({
      id: 3,
      name: "مشاهده",
    } as any);

    // شبیه‌سازی تراکنش موفق
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const txMock = {
        personnel: {
          create: vi.fn().mockResolvedValue({ id: 999 }),
          update: vi.fn().mockResolvedValue({ id: 101 }),
        },
      };
      return await callback(txMock);
    });

    const payload = {
      newRecords: [
        {
          rowIndex: 2,
          firstName: "کاربر",
          lastName: "جدید",
          personnelCode: "77889",
          shift: 1,
        },
      ],
      resolutions: [
        {
          rowIndex: 3,
          existingId: 101,
          action: "update" as const,
          data: {
            rowIndex: 3,
            firstName: "کاربر",
            lastName: "به‌روزرسانی",
            phone1: "09123334455",
          },
        },
        {
          rowIndex: 4,
          existingId: 102,
          action: "skip" as const,
          data: {
            rowIndex: 4,
            firstName: "کاربر",
            lastName: "صرف‌نظر",
          },
        },
      ],
    };

    const summary = await executePersonnelImportBatch(payload);

    expect(summary.ok).toBe(true);
    expect(summary.createdCount).toBe(1);
    expect(summary.updatedCount).toBe(1);
    expect(summary.skippedCount).toBe(1);
    expect(summary.totalProcessed).toBe(3);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
