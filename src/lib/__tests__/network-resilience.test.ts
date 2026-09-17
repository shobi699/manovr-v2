import { describe, it, expect, vi } from "vitest";
import { isSqliteLockOrIoError, executeWithRetry } from "@/lib/prisma";

describe("Network Resilience and SQLite Error 2570 Detection (database-server-falt)", () => {
  it("detects exact Prisma Rust engine extended_code 2570 error from screenshot", () => {
    const errorFromScreenshot = new Error(
      'ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(SqliteError { extended_code: 2570, message: Some("disk I/O error") }), transient: false })'
    );
    expect(isSqliteLockOrIoError(errorFromScreenshot)).toBe(true);
  });

  it("detects various SQLite lock, sharing violation and VFS delete errors", () => {
    expect(isSqliteLockOrIoError(new Error("SqliteError: disk I/O error"))).toBe(true);
    expect(isSqliteLockOrIoError(new Error("database is locked"))).toBe(true);
    expect(isSqliteLockOrIoError(new Error("sqlite_busy: timeout expired"))).toBe(true);
    expect(isSqliteLockOrIoError(new Error("xdelete of a vfs object failed"))).toBe(true);
    expect(isSqliteLockOrIoError(new Error("ERROR_SHARING_VIOLATION: file locked"))).toBe(true);
    expect(isSqliteLockOrIoError({ code: "P2034", message: "Transaction failed" })).toBe(true);
    expect(isSqliteLockOrIoError({ code: "P2028", message: "Transaction timeout" })).toBe(true);
  });

  it("does not false-positive on standard non-lock business errors", () => {
    expect(isSqliteLockOrIoError(new Error("کلمه عبور نامعتبر است"))).toBe(false);
    expect(isSqliteLockOrIoError(new Error("Record not found in database"))).toBe(false);
    expect(isSqliteLockOrIoError(new Error("Validation failed for field code"))).toBe(false);
    expect(isSqliteLockOrIoError(null)).toBe(false);
    expect(isSqliteLockOrIoError(undefined)).toBe(false);
  });

  it("retries an action that initially encounters 2570 lock error and then succeeds", async () => {
    let callCount = 0;
    const action = vi.fn(async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error("SqliteError { extended_code: 2570, message: Some(\"disk I/O error\") }");
      }
      return { success: true, count: callCount };
    });

    const result = await executeWithRetry(action, 5000);
    expect(result).toEqual({ success: true, count: 3 });
    expect(action).toHaveBeenCalledTimes(3);
  });

  it("immediately throws non-lock errors without retrying", async () => {
    const action = vi.fn(async () => {
      throw new Error("قطاری با این کد وجود دارد");
    });

    await expect(executeWithRetry(action, 2000)).rejects.toThrow("قطاری با این کد وجود دارد");
    expect(action).toHaveBeenCalledTimes(1);
  });
});
