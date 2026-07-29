import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accessRole: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    },
    personnel: {
      count: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  audit: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache: (fn: any) => fn,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteRole, createRole } from "@/app/actions/role";

describe("role server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prevents deleting system built-in roles", async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 1,
      role: 1,
      perms: ["role.manage"],
    } as any);

    vi.mocked(prisma.accessRole.findUnique).mockResolvedValue({
      id: 1,
      name: "مدیر کل",
      isSystem: true,
    } as any);

    const result = await deleteRole(1);
    expect(result.error).toContain("نقش‌های سیستمی قابل حذف نیستند");
  });

  it("blocks createRole if user lacks role.manage permission", async () => {
    vi.mocked(getSession).mockResolvedValue(null as any);
    const fd = new FormData();
    fd.append("name", "نقش جدید");
    const result = await createRole(null, fd);
    expect(result.error).toContain("دسترسی ندارید");
  });
});
