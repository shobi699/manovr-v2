import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { PERSONNEL_SAFE_FIELDS } from "@/lib/report-engine";

function personnelScalarFields(): string[] {
  const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
  const schema = readFileSync(schemaPath, "utf8");
  const block = schema.match(/model Personnel \{([\s\S]*?)\n\}/);
  if (!block) throw new Error("Personnel model not found in prisma/schema.prisma");
  return block[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//") && !line.startsWith("@@"))
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean);
}

describe("Personnel schema sync", () => {
  it("ensures every PERSONNEL_SAFE_FIELDS entry exists in prisma/schema.prisma", () => {
    const fields = personnelScalarFields();
    for (const field of PERSONNEL_SAFE_FIELDS) {
      expect(fields).toContain(field);
    }
  });

  it("ensures passwordHash is defined in Personnel model but excluded from PERSONNEL_SAFE_FIELDS", () => {
    const fields = personnelScalarFields();
    expect(fields).toContain("passwordHash");
    expect(PERSONNEL_SAFE_FIELDS as readonly string[]).not.toContain("passwordHash");
  });
});
