import { describe, it, expect } from "vitest";
import { buildPrismaWhere, PERSONNEL_SAFE_FIELDS, PERSONNEL_SAFE_SELECT, sanitizeReportFields, type ReportFilter } from "@/lib/report-engine";

describe("buildPrismaWhere", () => {
  it("coerces a numeric field to a number, not a string", () => {
    const filters: ReportFilter[] = [{ field: "status", operator: "equals", value: "2" }];
    const where = buildPrismaWhere("manovr", filters);
    expect(where.status).toBe(2);
    expect(typeof where.status).toBe("number");
  });

  it("coerces a boolean field: 'true' becomes true", () => {
    const filters: ReportFilter[] = [{ field: "isDisposed", operator: "equals", value: "true" }];
    const where = buildPrismaWhere("train", filters);
    expect(where.isDisposed).toBe(true);
  });

  it("coerces a boolean field: 'false' becomes false", () => {
    const filters: ReportFilter[] = [{ field: "isDisposed", operator: "equals", value: "false" }];
    const where = buildPrismaWhere("train", filters);
    expect(where.isDisposed).toBe(false);
  });

  it("coerces a date field to a Date instance", () => {
    const filters: ReportFilter[] = [{ field: "createdAt", operator: "gt", value: "2026-01-01" }];
    const where = buildPrismaWhere("manovr", filters);
    expect(where.createdAt.gt).toBeInstanceOf(Date);
  });

  it("drops an empty value and falls back to the manovr soft-delete default", () => {
    const filters: ReportFilter[] = [{ field: "status", operator: "equals", value: "" }];
    const where = buildPrismaWhere("manovr", filters);
    expect(where.status).toEqual({ not: 3 });
  });

  it("builds the relational 'train' branch as a nested code filter", () => {
    const filters: ReportFilter[] = [{ field: "train", operator: "contains", value: "AC-1" }];
    const where = buildPrismaWhere("manovr", filters);
    expect(where.train).toEqual({ code: { contains: "AC-1" } });
  });

  it("builds the relational 'rahbar1' OR branch across firstName and lastName", () => {
    const filters: ReportFilter[] = [{ field: "rahbar1", operator: "contains", value: "Ali" }];
    const where = buildPrismaWhere("manovr", filters);
    expect(where.rahbar1.OR).toHaveLength(2);
    expect(where.rahbar1.OR).toEqual([
      { firstName: { contains: "Ali" } },
      { lastName: { contains: "Ali" } },
    ]);
  });

  it("applies the manovr soft-delete default when no filters are given", () => {
    expect(buildPrismaWhere("manovr", [])).toEqual({ status: { not: 3 } });
  });

  it("applies the train soft-delete default when no filters are given", () => {
    expect(buildPrismaWhere("train", [])).toEqual({ isDisposed: false });
  });

  it("lets an explicit status filter override the manovr soft-delete default", () => {
    const filters: ReportFilter[] = [{ field: "status", operator: "equals", value: "1" }];
    const where = buildPrismaWhere("manovr", filters);
    expect(where.status).toBe(1);
  });

  it("uses gte/lte for a 'between' operator on a numeric field", () => {
    const filters: ReportFilter[] = [
      { field: "capacity", operator: "between", value: "10", value2: "20" },
    ];
    const where = buildPrismaWhere("train", filters);
    expect(where.capacity).toEqual({ gte: 10, lte: 20 });
  });
});

describe("PERSONNEL_SAFE_FIELDS and sanitizeReportFields", () => {
  it("does not include passwordHash in PERSONNEL_SAFE_FIELDS", () => {
    expect(PERSONNEL_SAFE_FIELDS).not.toContain("passwordHash");
  });

  it("does not include passwordHash in PERSONNEL_SAFE_SELECT", () => {
    expect(PERSONNEL_SAFE_SELECT).not.toHaveProperty("passwordHash");
  });

  it("removes passwordHash from personnel report fields", () => {
    expect(sanitizeReportFields("personnel", ["firstName", "passwordHash"])).toEqual(["firstName"]);
    expect(sanitizeReportFields("personnel", ["passwordHash"])).toEqual([]);
  });

  it("leaves non-personnel report fields untouched", () => {
    expect(sanitizeReportFields("manovr", ["type", "anything"])).toEqual(["type", "anything"]);
  });
});
