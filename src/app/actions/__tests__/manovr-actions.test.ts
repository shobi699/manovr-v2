import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    personnel: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    manovr: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    train: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    line: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
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
import { finishManovr, confirmManovr, deleteManovr } from "@/app/actions/manovr";

describe("manovr server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks finishManovr when user lacks manovr.edit permission", async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 5,
      role: 3,
      perms: ["manovr.read"],
    } as any);

    const result = await finishManovr(100);
    expect(result.error).toContain("دسترسی ندارید");
  });

  it("blocks confirmManovr when user lacks manovr.confirm permission", async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 5,
      role: 3,
      perms: ["manovr.read"],
    } as any);

    const result = await confirmManovr(100, 1);
    expect(result.error).toContain("دسترسی ندارید");
  });

  it("blocks deleteManovr when user lacks manovr.delete permission", async () => {
    vi.mocked(getSession).mockResolvedValue(null as any);
    const result = await deleteManovr(100);
    expect(result.error).toContain("دسترسی ندارید");
  });
});
