import { describe, it, expect } from "vitest";
import { findUnmanageableIds, findMissingIds } from "@/lib/bulk-guards";

describe("bulk-guards helpers", () => {
  describe("findUnmanageableIds", () => {
    it("allows role-1 admin to manage lower role levels (role 3, role 0)", () => {
      const targets = [
        { id: 1, role: 3 },
        { id: 2, role: 0 },
      ];
      expect(findUnmanageableIds(1, targets)).toEqual([]);
    });

    it("blocks role-1 admin from managing role-4 super-admin", () => {
      const targets = [{ id: 1, role: 4 }];
      expect(findUnmanageableIds(1, targets)).toEqual([1]);
    });

    it("blocks role-1 admin from managing peer role-1 admin (peer cannot manage peer)", () => {
      const targets = [{ id: 1, role: 1 }];
      expect(findUnmanageableIds(1, targets)).toEqual([1]);
    });

    it("blocks role-4 super-admin from managing peer role-4 super-admin", () => {
      const targets = [
        { id: 1, role: 1 },
        { id: 2, role: 4 },
      ];
      expect(findUnmanageableIds(4, targets)).toEqual([2]);
    });

    it("filters mixed targets correctly", () => {
      const targets = [
        { id: 10, role: 3 },
        { id: 20, role: 4 },
        { id: 30, role: 0 },
      ];
      expect(findUnmanageableIds(1, targets)).toEqual([20]);
    });

    it("returns empty array for empty target list", () => {
      expect(findUnmanageableIds(1, [])).toEqual([]);
    });
  });

  describe("findMissingIds", () => {
    it("returns IDs that were requested but not found in database", () => {
      const requested = [1, 2, 3];
      const found = [
        { id: 1, role: 0 },
        { id: 3, role: 0 },
      ];
      expect(findMissingIds(requested, found)).toEqual([2]);
    });

    it("returns empty array when requested list is empty", () => {
      expect(findMissingIds([], [])).toEqual([]);
    });

    it("returns empty array when all requested IDs were found", () => {
      const requested = [10, 20];
      const found = [
        { id: 10, role: 1 },
        { id: 20, role: 2 },
      ];
      expect(findMissingIds(requested, found)).toEqual([]);
    });
  });
});
