import { describe, it, expect } from "vitest";
import {
  parseListParams,
  toPrismaPage,
  totalPageCount,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "@/lib/list-query";

describe("list-query helpers", () => {
  const allowedSort = ["createdAt", "code", "type", "status"];

  describe("parseListParams", () => {
    it("returns default values when params are empty", () => {
      const res = parseListParams({}, allowedSort);
      expect(res.page).toBe(1);
      expect(res.pageSize).toBe(DEFAULT_PAGE_SIZE);
      expect(res.search).toBe("");
      expect(res.sortField).toBeNull();
      expect(res.sortDir).toBe("desc");
    });

    it("clamps invalid or non-positive page numbers to 1", () => {
      expect(parseListParams({ page: "0" }, allowedSort).page).toBe(1);
      expect(parseListParams({ page: "-3" }, allowedSort).page).toBe(1);
      expect(parseListParams({ page: "abc" }, allowedSort).page).toBe(1);
    });

    it("clamps page sizes exceeding MAX_PAGE_SIZE or invalid options", () => {
      expect(MAX_PAGE_SIZE).toBe(100);
      expect(parseListParams({ pageSize: "999" }, allowedSort).pageSize).toBe(DEFAULT_PAGE_SIZE);
      expect(parseListParams({ pageSize: "7" }, allowedSort).pageSize).toBe(DEFAULT_PAGE_SIZE);
      expect(parseListParams({ pageSize: "50" }, allowedSort).pageSize).toBe(50);
    });

    it("accepts allowed sort fields and rejects unallowed fields", () => {
      expect(parseListParams({ sort: "createdAt" }, allowedSort).sortField).toBe("createdAt");
      expect(parseListParams({ sort: "passwordHash" }, allowedSort).sortField).toBeNull();
      expect(parseListParams({ sort: "secretColumn" }, allowedSort).sortField).toBeNull();
    });

    it("defaults invalid sort direction to desc", () => {
      expect(parseListParams({ dir: "asc" }, allowedSort).sortDir).toBe("asc");
      expect(parseListParams({ dir: "sideways" }, allowedSort).sortDir).toBe("desc");
    });

    it("takes the first element of array-valued parameters", () => {
      expect(parseListParams({ page: ["2", "5"] }, allowedSort).page).toBe(2);
    });
  });

  describe("toPrismaPage", () => {
    it("calculates skip and take correctly", () => {
      const p1 = parseListParams({ page: "1", pageSize: "20" }, allowedSort);
      expect(toPrismaPage(p1)).toEqual({ skip: 0, take: 20 });

      const p3 = parseListParams({ page: "3", pageSize: "20" }, allowedSort);
      expect(toPrismaPage(p3)).toEqual({ skip: 40, take: 20 });
    });
  });

  describe("totalPageCount", () => {
    it("calculates total page count accurately with minimum 1", () => {
      expect(totalPageCount(0, 20)).toBe(1);
      expect(totalPageCount(20, 20)).toBe(1);
      expect(totalPageCount(21, 20)).toBe(2);
    });
  });
});
