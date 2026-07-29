import { describe, it, expect } from "vitest";
import { hasRoomOnLine, shouldSetKafshak, KAFSHAK_MANOVR_TYPE } from "@/lib/manovr-rules";

describe("manovr rules", () => {
  describe("hasRoomOnLine", () => {
    it("returns true when occupant count is less than line capacity", () => {
      expect(hasRoomOnLine(0, 1)).toBe(true);
      expect(hasRoomOnLine(3, 5)).toBe(true);
    });

    it("returns false when occupant count equals or exceeds line capacity", () => {
      expect(hasRoomOnLine(1, 1)).toBe(false);
      expect(hasRoomOnLine(2, 1)).toBe(false);
      expect(hasRoomOnLine(5, 5)).toBe(false);
    });

    it("returns false for zero-capacity line", () => {
      expect(hasRoomOnLine(0, 0)).toBe(false);
    });
  });

  describe("shouldSetKafshak", () => {
    it("returns true for type 20 manovr", () => {
      expect(shouldSetKafshak(KAFSHAK_MANOVR_TYPE)).toBe(true);
      expect(shouldSetKafshak(20)).toBe(true);
    });

    it("returns false for non-20 manovr types", () => {
      expect(shouldSetKafshak(19)).toBe(false);
      expect(shouldSetKafshak(21)).toBe(false);
      expect(shouldSetKafshak(0)).toBe(false);
    });
  });
});
