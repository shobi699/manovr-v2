import { describe, it, expect } from "vitest";
import { computeDiff } from "@/lib/audit";

describe("computeDiff", () => {
  it("never includes passwordHash in the diff, even when it changed — plan 003 depends on this", () => {
    const before = { passwordHash: "a", role: 1 };
    const after = { passwordHash: "b", role: 2 };

    const diff = computeDiff(before, after);

    expect(diff).not.toHaveProperty("passwordHash");
    expect(diff).toHaveProperty("role");
    expect(diff.role).toEqual({ old: 1, new: 2 });
  });

  it("excludes createdAt, updatedAt, and id even when they changed", () => {
    const before = { createdAt: "2026-01-01", updatedAt: "2026-01-01", id: 1, role: 1 };
    const after = { createdAt: "2026-01-02", updatedAt: "2026-01-02", id: 2, role: 1 };

    const diff = computeDiff(before, after);

    expect(diff).not.toHaveProperty("createdAt");
    expect(diff).not.toHaveProperty("updatedAt");
    expect(diff).not.toHaveProperty("id");
    expect(diff).not.toHaveProperty("role");
  });

  it("skips object-valued and array-valued keys", () => {
    const before = { nested: { a: 1 }, list: [1, 2], role: 1 };
    const after = { nested: { a: 2 }, list: [1, 2, 3], role: 1 };

    const diff = computeDiff(before, after);

    expect(diff).not.toHaveProperty("nested");
    expect(diff).not.toHaveProperty("list");
  });

  it("produces no entry for unchanged scalars", () => {
    const before = { role: 1, name: "x" };
    const after = { role: 1, name: "x" };

    const diff = computeDiff(before, after);

    expect(Object.keys(diff)).toHaveLength(0);
  });

  // رفتار فعلی (باگ‌دار) — عمداً ثبت شده تا تغییرات آینده قابل تشخیص باشد.
  // typeof null === "object" است، بنابراین گارد فیلدهای رابطه‌ای در
  // src/lib/audit.ts:16 هر تغییری را که یک طرف آن null باشد حذف می‌کند.
  // این یعنی مقداردهی اولیه یا پاک‌کردن هر فیلد nullable در لاگ وقایع ثبت نمی‌شود.
  // پس از اصلاح این باگ، این تست باید شکست بخورد — آنگاه it.todo زیر را فعال کنید.
  it("CHARACTERIZATION (known bug): drops changes where either side is null", () => {
    expect(computeDiff({ phone1: null }, { phone1: "0912" })).toEqual({});
    expect(computeDiff({ phone1: "0912" }, { phone1: null })).toEqual({});
  });

  it.todo(
    "should record null -> value and value -> null transitions " +
      "(blocked on fixing the typeof-null guard in src/lib/audit.ts:16)"
  );

  it("records all fields when before is null (CREATE path)", () => {
    const diff = computeDiff(null, { phone1: "0912", role: 2 });
    expect(diff.phone1).toEqual({ old: null, new: "0912" });
    expect(diff.role).toEqual({ old: null, new: 2 });
  });

  it("does not throw when before is null, and reports keys from after", () => {
    expect(() => computeDiff(null, { a: 1 })).not.toThrow();
    const diff = computeDiff(null, { a: 1 });
    expect(diff).toHaveProperty("a");
    expect(diff.a).toEqual({ old: null, new: 1 });
  });
});
