import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    personnel: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    manovr: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    train: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    line: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((fn: any) => fn(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

vi.mock("@/lib/audit", () => ({
  audit: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("@/lib/network-status", () => ({
  getNetworkStatus: vi.fn().mockResolvedValue({ isShared: true, isOnline: true }),
}));

vi.mock("@/lib/settings", () => ({
  getOfflinePolicy: vi.fn().mockResolvedValue("write_local"),
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
import {
  finishManovr,
  confirmManovr,
  bulkConfirmManovr,
  bulkFinishManovr,
  bulkDeleteManovr,
  deleteManovr,
  createManovr,
} from "@/app/actions/manovr";

describe("manovr server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("finishManovr & Locking Rules", () => {
    it("blocks finishManovr when user lacks manovr.edit permission", async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 5,
        role: 3,
        perms: ["manovr.view"],
      } as any);

      const result = await finishManovr(100);
      expect(result.error).toContain("دسترسی ندارید");
    });

    it("blocks finishManovr when the shunting task is already completed (status 2)", async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 2,
        role: 2,
        perms: ["manovr.edit"],
      } as any);

      vi.mocked(prisma.manovr.findUnique).mockResolvedValue({
        id: 101,
        status: 2, // به پایان رسید
        confirmationStatus: 1,
      } as any);

      const result = await finishManovr(101);
      expect(result.error).toContain("قبلاً به پایان رسیده است");
      expect(prisma.manovr.update).not.toHaveBeenCalled();
    });

    it("successfully finishes an in-progress shunting task (status 1)", async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 2,
        role: 2,
        perms: ["manovr.edit"],
      } as any);

      vi.mocked(prisma.manovr.findUnique).mockResolvedValue({
        id: 102,
        status: 1,
        confirmationStatus: 3,
      } as any);

      vi.mocked(prisma.manovr.update).mockResolvedValue({
        id: 102,
        status: 2,
      } as any);

      const result = await finishManovr(102);
      expect(result.ok).toBe(true);
      expect(prisma.manovr.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 102 },
          data: expect.objectContaining({ status: 2 }),
        })
      );
    });
  });

  describe("confirmManovr & bulkConfirmManovr", () => {
    it("blocks confirmManovr when user lacks manovr.confirm permission", async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 5,
        role: 3,
        perms: ["manovr.view"],
      } as any);

      const result = await confirmManovr(100, 1);
      expect(result.error).toContain("دسترسی ندارید");
    });

    it("blocks bulkConfirmManovr when user lacks manovr.confirm permission", async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 5,
        role: 3,
        perms: ["manovr.view"],
      } as any);

      const result = await bulkConfirmManovr([10, 11], 1);
      expect(result.error).toContain("دسترسی ندارید");
    });

    it("validates empty ids in bulkConfirmManovr", async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 2,
        role: 2,
        perms: ["manovr.confirm"],
      } as any);

      const result = await bulkConfirmManovr([], 1);
      expect(result.error).toBeDefined();
    });

    it("executes bulkConfirmManovr successfully across multiple shunting records", async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 2,
        role: 2,
        perms: ["manovr.confirm"],
      } as any);

      vi.mocked(prisma.manovr.findMany).mockResolvedValue([
        { id: 201, confirmationStatus: 3 },
        { id: 202, confirmationStatus: 3 },
      ] as any);

      vi.mocked(prisma.manovr.updateMany).mockResolvedValue({ count: 2 } as any);

      const result = await bulkConfirmManovr([201, 202], 1);
      expect(result.ok).toBe(true);
      expect(result.count).toBe(2);
      expect(prisma.manovr.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: [201, 202] } },
          data: { confirmationStatus: 1 },
        })
      );
    });
  });

  describe("deleteManovr & Manager-Restricted Permissions", () => {
    it("blocks deleteManovr when user lacks session", async () => {
      vi.mocked(getSession).mockResolvedValue(null as any);
      const result = await deleteManovr(100);
      expect(result.error).toContain("دسترسی ندارید");
    });

    it("blocks regular role from deleting completed shunting task (status 2) even with manovr.delete", async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 10,
        role: 2, // مسئول / اپراتور (نقش استاندارد)
        perms: ["manovr.delete", "manovr.edit"],
      } as any);

      vi.mocked(prisma.manovr.findUnique).mockResolvedValue({
        id: 301,
        status: 2, // به پایان رسید / تکمیل‌شده
      } as any);

      const result = await deleteManovr(301);
      expect(result.error).toContain("منحصراً در اختیارات مدیر سیستم می‌باشد");
      expect(prisma.manovr.update).not.toHaveBeenCalled();
    });

    it("allows manager/admin (role 1) to delete completed shunting task (status 2)", async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 1,
        role: 1, // مدیر / ادمین
        perms: ["manovr.delete"],
      } as any);

      vi.mocked(prisma.manovr.findUnique).mockResolvedValue({
        id: 302,
        status: 2, // تکمیل‌شده
      } as any);

      vi.mocked(prisma.manovr.update).mockResolvedValue({
        id: 302,
        status: 3,
      } as any);

      const result = await deleteManovr(302);
      expect(result.ok).toBe(true);
      expect(prisma.manovr.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 302 },
          data: { status: 3 },
        })
      );
    });

    it("allows regular role to delete non-completed shunting task (status 1) if they have manovr.delete", async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 12,
        role: 2,
        perms: ["manovr.delete"],
      } as any);

      vi.mocked(prisma.manovr.findUnique).mockResolvedValue({
        id: 303,
        status: 1, // در حال اجرا (شروع‌شده)
      } as any);

      vi.mocked(prisma.manovr.update).mockResolvedValue({
        id: 303,
        status: 3,
      } as any);

      const result = await deleteManovr(303);
      expect(result.ok).toBe(true);
      expect(prisma.manovr.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 303 },
          data: { status: 3 },
        })
      );
    });
  });

  describe("bulkFinishManovr & bulkDeleteManovr", () => {
    it("bulkFinishManovr closes multiple active maneuvers successfully", async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 2,
        role: 2,
        perms: ["manovr.edit"],
      } as any);

      vi.mocked(prisma.manovr.findMany).mockResolvedValue([
        { id: 401, trainId: 10 },
        { id: 402, trainId: 11 },
      ] as any);

      vi.mocked(prisma.manovr.updateMany).mockResolvedValue({ count: 2 } as any);

      const result = await bulkFinishManovr([401, 402]);
      expect(result.ok).toBe(true);
      expect(result.count).toBe(2);
      expect(prisma.manovr.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: [401, 402] } },
          data: expect.objectContaining({ status: 2 }),
        })
      );
    });

    it("bulkDeleteManovr soft-deletes multiple maneuvers successfully", async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 1,
        role: 1, // مدیر
        perms: ["manovr.delete"],
      } as any);

      vi.mocked(prisma.manovr.findMany).mockResolvedValue([
        { id: 501, status: 1 },
        { id: 502, status: 2 },
      ] as any);

      vi.mocked(prisma.manovr.updateMany).mockResolvedValue({ count: 2 } as any);

      const result = await bulkDeleteManovr([501, 502]);
      expect(result.ok).toBe(true);
      expect(result.count).toBe(2);
      expect(prisma.manovr.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: [501, 502] } },
          data: { status: 3 },
        })
      );
    });

    it("createManovr creates maneuver with part-time driver as rahbar1Id", async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 1,
        role: 1,
        perms: ["manovr.create"],
      } as any);

      vi.mocked(prisma.train.findUnique).mockResolvedValue({
        id: 10,
        code: "101",
        lineId: 1,
        slotIndex: 0,
        type: 0,
      } as any);

      vi.mocked(prisma.line.findUnique).mockResolvedValue({
        id: 2,
        name: "خط ۲",
        capacity: 5,
        terminal: 1,
        trains: [],
      } as any);

      vi.mocked(prisma.train.count).mockResolvedValue(0);
      vi.mocked(prisma.train.findFirst).mockResolvedValue(null);

      vi.mocked(prisma.personnel.findUnique).mockResolvedValue({
        id: 88,
        firstName: "علی",
        lastName: "شفیعی",
        orgPosition: 5, // تکنسین
        isPartTimeDriver: true,
      } as any);

      vi.mocked(prisma.manovr.create).mockResolvedValue({
        id: 999,
        type: 2,
        status: 1,
        rahbar1Id: 88,
      } as any);

      const fd = new FormData();
      fd.append("type", "2");
      fd.append("trainId", "10");
      fd.append("rahbar1Id", "88");
      fd.append("sourceLineId", "1");
      fd.append("destinationLineId", "2");
      fd.append("noRedirect", "true");

      const result = await createManovr(null, fd);
      expect(result?.error).toBeUndefined();
      expect(result?.success).toBe(true);
      expect(prisma.manovr.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rahbar1Id: 88,
          }),
        })
      );
    });
  });
});

