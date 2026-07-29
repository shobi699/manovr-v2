import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL_SECRET = process.env.AUTH_SECRET;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  if (ORIGINAL_SECRET !== undefined) {
    process.env.AUTH_SECRET = ORIGINAL_SECRET;
  } else {
    delete process.env.AUTH_SECRET;
  }
});

describe("auth module secret guard", () => {
  it("refuses to load without AUTH_SECRET", async () => {
    delete process.env.AUTH_SECRET;
    await expect(import("@/lib/auth")).rejects.toThrow(/AUTH_SECRET/);
  });

  it("refuses to load when AUTH_SECRET is shorter than 32 characters", async () => {
    process.env.AUTH_SECRET = "short-secret-key";
    await expect(import("@/lib/auth")).rejects.toThrow(/AUTH_SECRET/);
  });

  it("loads successfully when AUTH_SECRET is 32+ characters and exposes session functions", async () => {
    process.env.AUTH_SECRET = "x".repeat(48);
    const authModule = await import("@/lib/auth");
    expect(authModule.createSession).toBeTypeOf("function");
    expect(authModule.getSession).toBeTypeOf("function");
    expect(authModule.destroySession).toBeTypeOf("function");
  });
});
