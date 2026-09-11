import { describe, it, expect } from "vitest";
import { getTargetSharedPath, getNetworkStatus } from "@/lib/network-status";

describe("Network and Database Connection Status detection", () => {
  it("resolves the target shared path from config or environment", () => {
    const target = getTargetSharedPath();
    expect(target).toBeDefined();
    expect(typeof target).toBe("string");
    expect(target.length).toBeGreaterThan(0);
    // باید مسیر معتبر سرور دپو یا پوشه شبکه باشد
    expect(target.includes("Depo") || target.includes("data") || target.includes("srvdfs01")).toBe(true);
  });

  it("returns full status result with database response and metrics", async () => {
    const status = await getNetworkStatus();

    expect(status).toHaveProperty("isShared");
    expect(status).toHaveProperty("isDatabaseReady");
    expect(status).toHaveProperty("targetSharedPath");
    expect(status).toHaveProperty("activeDatabasePath");
    expect(status).toHaveProperty("storageSource");
    expect(status).toHaveProperty("pingMs");
    expect(status).toHaveProperty("sharedPathAccessible");
    expect(status).toHaveProperty("serverHostname");
    expect(status).toHaveProperty("checkedAt");

    expect(typeof status.isShared).toBe("boolean");
    expect(typeof status.isDatabaseReady).toBe("boolean");
    expect(typeof status.pingMs).toBe("number");
    expect(typeof status.targetSharedPath).toBe("string");
    expect(typeof status.activeDatabasePath).toBe("string");
  });
});
