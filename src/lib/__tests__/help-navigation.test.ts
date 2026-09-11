import { describe, it, expect } from "vitest";
import { Icons } from "@/lib/icons";

describe("Help & Documentation System", () => {
  it("exports Help icon from Phosphor icons registry", () => {
    expect(Icons.Help).toBeDefined();
  });
});
