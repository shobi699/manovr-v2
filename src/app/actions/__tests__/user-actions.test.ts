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
      delete: vi.fn(),
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
  unstable_cache: (fn: any) => fn,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { getSession } from "@/lib/auth";
import { bulkDeleteUsers } from "@/app/actions/user";

describe("user server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns permission error when unauthenticated or lacking user.manage permission", async () => {
    vi.mocked(getSession).mockResolvedValue(null as any);
    const result = await bulkDeleteUsers([10, 11]);
    expect(result.error).toContain("دسترسی ندارید");
  });

  it("prevents deleting users who belong to higher or equal role hierarchy", async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 1,
      role: 2,
      perms: ["user.manage"],
    } as any);

    const result = await bulkDeleteUsers([1, 2]);
    expect(result.error).toBeDefined();
  });
});
