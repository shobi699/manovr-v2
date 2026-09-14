import { describe, it, expect } from "vitest";
import { setupVirtualNetworkShare, sleepWithJitter } from "../../../scripts/simulate-network";
import { PrismaClient } from "@prisma/client";

describe("US2: شبیه‌سازی پوشه شبکه مجازی با پینگ نامساعد و تاخیر بالا (Virtual Network Share Simulation)", () => {
  it("باید پوشه مجازی شبکه را با دیتابیس کپی‌شده مقداردهی اولیه کند", () => {
    const result = setupVirtualNetworkShare();
    expect(result.virtualShareDir).toBeDefined();
    expect(result.targetDb).toBeDefined();
  });

  it("باید تاخیر مصنوعی پینگ (بین ۱۰۰ تا ۸۰۰ میلی‌ثانیه) را به درستی شبیه‌سازی کند", async () => {
    const t0 = Date.now();
    await sleepWithJitter(100, 250);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeGreaterThanOrEqual(90);
  });

  it("باید در شرایط تاخیر بالای شبیه‌سازی‌شده، تراکنش‌ها با موفقیت و بدون کرش انجام شوند", async () => {
    const { targetDb } = setupVirtualNetworkShare();
    const simulatedClient = new PrismaClient({
      datasources: {
        db: {
          url: `file:${targetDb}`,
        },
      },
    });

    try {
      // شبیه‌سازی تراکنش تحت پینگ ضعیف
      await sleepWithJitter(150, 300);
      const lines = await simulatedClient.line.findMany({ take: 3 });
      expect(Array.isArray(lines)).toBe(true);

      await sleepWithJitter(150, 300);
      const trains = await simulatedClient.train.findMany({ take: 3 });
      expect(Array.isArray(trains)).toBe(true);
    } finally {
      await simulatedClient.$disconnect();
    }
  });
});
