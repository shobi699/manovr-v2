import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    personnel: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    manovr: {
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
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

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bulkDeleteUsers, bulkUpdateUserShift } from "@/app/actions/user";

/**
 * نشست یک ادمین با مجوز user.manage.
 * hasPerm از طریق getUserPerms رکورد پرسنل را می‌خواند؛ بدون accessRole
 * به LEGACY[role] برمی‌گردد که برای نقش ۱ شامل تمام مجوزهاست.
 */
function mockAdminSession(id = 1, role = 1) {
  vi.mocked(getSession).mockResolvedValue({
    id,
    role,
    userName: "admin",
    fullName: "مدیر سامانه",
  } as any);
  vi.mocked(prisma.personnel.findUnique).mockResolvedValue({
    id,
    role,
    accessRole: null,
  } as any);
}

/** حالت پیش‌فرض امن: هیچ ارجاعی در مانورها وجود ندارد */
function mockNoManovrReferences() {
  vi.mocked(prisma.manovr.findMany).mockResolvedValue([] as any);
}

describe("user server actions — bulk guards (plan 016)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses bulk delete when the caller is unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null as any);

    const result = await bulkDeleteUsers([10, 11]);

    expect(result.error).toContain("دسترسی ندارید");
    expect(prisma.personnel.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses bulk delete when the only selected id is the caller's own", async () => {
    mockAdminSession(7);

    const result = await bulkDeleteUsers([7]);

    expect(result.error).toContain("حساب کاربری خودتان");
    expect(prisma.personnel.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses bulk delete when any target outranks the caller, and deletes nothing", async () => {
    mockAdminSession(1, 1);
    // هدف دوم سوپرادمین نقش ۴ است — بالاتر از اقدام‌کننده نقش ۱
    vi.mocked(prisma.personnel.findMany).mockResolvedValue([
      { id: 10, role: 3 },
      { id: 11, role: 4 },
    ] as any);
    mockNoManovrReferences();

    const result = await bulkDeleteUsers([10, 11]);

    // پیام باید دقیقاً درباره سلسله‌مراتب باشد، نه یک خطای عمومی
    expect(result.error).toContain("هم‌سطح یا بالاتر از شما");
    expect(result.error).toContain("هیچ کاربری حذف نشد");
    // مهم‌ترین ادعا: هیچ حذفی انجام نشده است
    expect(prisma.personnel.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses bulk delete when a target is referenced by a manovr, and deletes nothing", async () => {
    mockAdminSession(1, 1);
    vi.mocked(prisma.personnel.findMany).mockResolvedValue([
      { id: 10, role: 3 },
      { id: 11, role: 0 },
    ] as any);
    // مانوری که کاربر ۱۰ را به عنوان راهبر ثبت کرده است
    vi.mocked(prisma.manovr.findMany).mockResolvedValue([
      { rahbar1Id: 10, rahbar2Id: null, creatorId: null },
    ] as any);

    const result = await bulkDeleteUsers([10, 11]);

    expect(result.error).toContain("در مانورها ثبت شده‌اند");
    expect(result.error).toContain("غیرفعال");
    expect(prisma.personnel.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes when every target is manageable and unreferenced", async () => {
    mockAdminSession(1, 1);
    vi.mocked(prisma.personnel.findMany).mockResolvedValue([
      { id: 10, role: 3 },
      { id: 11, role: 0 },
    ] as any);
    mockNoManovrReferences();
    vi.mocked(prisma.personnel.deleteMany).mockResolvedValue({ count: 2 } as any);

    const result = await bulkDeleteUsers([10, 11]);

    expect(result.error).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(result.count).toBe(2);
    expect(prisma.personnel.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [10, 11] } },
    });
  });

  it("excludes the caller's own id from a bulk delete but proceeds with the rest", async () => {
    mockAdminSession(1, 1);
    vi.mocked(prisma.personnel.findMany).mockResolvedValue([
      { id: 10, role: 3 },
    ] as any);
    mockNoManovrReferences();
    vi.mocked(prisma.personnel.deleteMany).mockResolvedValue({ count: 1 } as any);

    const result = await bulkDeleteUsers([1, 10]);

    expect(result.ok).toBe(true);
    expect(prisma.personnel.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [10] } },
    });
  });

  it("refuses a bulk shift change when a target outranks the caller, and updates nothing", async () => {
    mockAdminSession(1, 1);
    vi.mocked(prisma.personnel.findMany).mockResolvedValue([
      { id: 20, role: 4 },
    ] as any);

    const result = await bulkUpdateUserShift([20], 2);

    expect(result.error).toContain("هم‌سطح یا بالاتر از شما");
    expect(prisma.personnel.updateMany).not.toHaveBeenCalled();
  });

  it("applies a bulk shift change when every target is manageable", async () => {
    mockAdminSession(1, 1);
    vi.mocked(prisma.personnel.findMany).mockResolvedValue([
      { id: 20, role: 3 },
      { id: 21, role: 0 },
    ] as any);
    vi.mocked(prisma.personnel.updateMany).mockResolvedValue({ count: 2 } as any);

    const result = await bulkUpdateUserShift([20, 21], 2);

    expect(result.error).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(prisma.personnel.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [20, 21] } },
      data: { shift: 2 },
    });
  });
});
