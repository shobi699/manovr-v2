import { describe, it, expect } from "vitest";
import path from "path";
import { resolveScheduledOutputDir, scheduledOutputRoot, SCHEDULED_OUTPUT_ROOT } from "@/lib/report-output";

const TEST_CWD = process.platform === "win32" ? "C:\\app" : "/app";

describe("resolveScheduledOutputDir", () => {
  const root = scheduledOutputRoot(TEST_CWD);

  it("returns null for empty or whitespace-only inputs", () => {
    expect(resolveScheduledOutputDir("", TEST_CWD)).toBeNull();
    expect(resolveScheduledOutputDir("   ", TEST_CWD)).toBeNull();
  });

  it("resolves valid relative subfolders inside the root", () => {
    const res1 = resolveScheduledOutputDir("daily", TEST_CWD);
    expect(res1).not.toBeNull();
    expect(path.relative(root, res1!)).toBe("daily");

    const res2 = resolveScheduledOutputDir("a/b/c", TEST_CWD);
    expect(res2).not.toBeNull();
    expect(path.relative(root, res2!)).toBe(path.join("a", "b", "c"));
  });

  it("rejects path traversal attempts outside root", () => {
    expect(resolveScheduledOutputDir("..", TEST_CWD)).toBeNull();
    expect(resolveScheduledOutputDir("../../etc", TEST_CWD)).toBeNull();
    expect(resolveScheduledOutputDir("daily/../../..", TEST_CWD)).toBeNull();
  });

  it("rejects absolute POSIX, Windows drive, UNC paths, and null bytes", () => {
    expect(resolveScheduledOutputDir("/tmp/x", TEST_CWD)).toBeNull();
    expect(resolveScheduledOutputDir("C:/Windows/System32", TEST_CWD)).toBeNull();
    expect(resolveScheduledOutputDir("C:\\Windows\\System32", TEST_CWD)).toBeNull();
    expect(resolveScheduledOutputDir("\\\\server\\share", TEST_CWD)).toBeNull();
    expect(resolveScheduledOutputDir("daily\0sub", TEST_CWD)).toBeNull();
  });

  it("rejects sibling directory traversal with matching prefix (scheduled-evil)", () => {
    expect(resolveScheduledOutputDir("../scheduled-evil", TEST_CWD)).toBeNull();
  });

  it("handles legacy full-prefix forms correctly", () => {
    const resRoot = resolveScheduledOutputDir(SCHEDULED_OUTPUT_ROOT, TEST_CWD);
    expect(resRoot).toBe(root);

    const resDaily = resolveScheduledOutputDir(`${SCHEDULED_OUTPUT_ROOT}/daily`, TEST_CWD);
    expect(resDaily).not.toBeNull();
    expect(path.relative(root, resDaily!)).toBe("daily");
  });

  it("returns null for non-string inputs without throwing", () => {
    expect(resolveScheduledOutputDir(null as any, TEST_CWD)).toBeNull();
    expect(resolveScheduledOutputDir(undefined as any, TEST_CWD)).toBeNull();
    expect(resolveScheduledOutputDir(42 as any, TEST_CWD)).toBeNull();
  });
});
