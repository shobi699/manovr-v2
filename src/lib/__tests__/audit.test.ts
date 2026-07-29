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

  it("records a null -> value transition", () => {
    expect(computeDiff({ phone1: null }, { phone1: "0912" })).toEqual({
      phone1: { old: null, new: "0912" },
    });
  });

  it("records a value -> null transition", () => {
    expect(computeDiff({ phone1: "0912" }, { phone1: null })).toEqual({
      phone1: { old: "0912", new: null },
    });
  });

  it("records granting and revoking an access role", () => {
    expect(computeDiff({ accessRoleId: null }, { accessRoleId: 5 })).toEqual({
      accessRoleId: { old: null, new: 5 },
    });
    expect(computeDiff({ accessRoleId: 5 }, { accessRoleId: null })).toEqual({
      accessRoleId: { old: 5, new: null },
    });
  });

  it("still skips relation objects and arrays", () => {
    const before = { name: "a", train: { id: 1, code: "AC-1" }, tags: ["x"] };
    const after = { name: "b", train: { id: 2, code: "AC-2" }, tags: ["y"] };
    const diff = computeDiff(before, after);
    expect(diff).toEqual({ name: { old: "a", new: "b" } });
    expect(diff).not.toHaveProperty("train");
    expect(diff).not.toHaveProperty("tags");
  });

  it("does not record a null -> null non-change", () => {
    expect(computeDiff({ phone1: null }, { phone1: null })).toEqual({});
  });

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
