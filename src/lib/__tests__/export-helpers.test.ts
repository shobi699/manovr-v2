import { describe, it, expect } from "vitest";
import { farsi } from "@/lib/export-helpers";

describe("farsi", () => {
  it("returns an empty string for empty input", () => {
    expect(farsi("")).toBe("");
  });

  it("reverses word order for an ASCII-only string, leaving each word's characters intact", () => {
    expect(farsi("AC 101")).toBe("101 AC");
  });

  it("round-trips a Persian string to a non-empty, different string", () => {
    const input = "سلام دنیا";
    const output = farsi(input);
    expect(output.length).toBeGreaterThan(0);
    expect(output).not.toBe(input);
  });
});
