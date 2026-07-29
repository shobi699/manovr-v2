import { describe, it, expect } from "vitest";
import {
  DEFAULT_ACCENT_COLOR,
  isValidAccentColor,
  safeAccentColor,
  safeLogoImage,
  safeText,
} from "@/lib/branding";

describe("branding validators", () => {
  describe("isValidAccentColor & safeAccentColor", () => {
    it("accepts valid 6-digit hex color strings", () => {
      expect(isValidAccentColor("#d8842a")).toBe(true);
      expect(isValidAccentColor("#FFFFFF")).toBe(true);
      expect(safeAccentColor("#d8842a")).toBe("#d8842a");
    });

    it("rejects 3-digit short hex colors", () => {
      expect(isValidAccentColor("#fff")).toBe(false);
      expect(safeAccentColor("#fff")).toBe(DEFAULT_ACCENT_COLOR);
    });

    it("rejects 8-digit hex colors with alpha", () => {
      expect(isValidAccentColor("#d8842aff")).toBe(false);
      expect(safeAccentColor("#d8842aff")).toBe(DEFAULT_ACCENT_COLOR);
    });

    it("rejects named colors or rgb expressions", () => {
      expect(isValidAccentColor("red")).toBe(false);
      expect(isValidAccentColor("rgb(0,0,0)")).toBe(false);
      expect(safeAccentColor("red")).toBe(DEFAULT_ACCENT_COLOR);
    });

    it("rejects style-breakout injection attempts", () => {
      const payload = "#000; } * { display: none } /*";
      expect(isValidAccentColor(payload)).toBe(false);
      expect(safeAccentColor(payload)).toBe(DEFAULT_ACCENT_COLOR);
    });

    it("handles non-string values safely without throwing", () => {
      expect(safeAccentColor(null)).toBe(DEFAULT_ACCENT_COLOR);
      expect(safeAccentColor(undefined)).toBe(DEFAULT_ACCENT_COLOR);
      expect(safeAccentColor(42)).toBe(DEFAULT_ACCENT_COLOR);
      expect(safeAccentColor({})).toBe(DEFAULT_ACCENT_COLOR);
    });
  });

  describe("safeLogoImage", () => {
    it("accepts valid image data URLs", () => {
      const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      expect(safeLogoImage(dataUrl)).toBe(dataUrl);
    });

    it("accepts relative paths", () => {
      expect(safeLogoImage("/logo.png")).toBe("/logo.png");
      expect(safeLogoImage("/assets/brand/logo.svg")).toBe("/assets/brand/logo.svg");
    });

    it("rejects absolute remote URLs", () => {
      expect(safeLogoImage("https://example.com/x.png")).toBe("");
    });

    it("rejects javascript: URLs", () => {
      expect(safeLogoImage("javascript:alert(1)")).toBe("");
    });

    it("handles invalid or non-string inputs safely", () => {
      expect(safeLogoImage("")).toBe("");
      expect(safeLogoImage(null)).toBe("");
      expect(safeLogoImage(undefined)).toBe("");
      expect(safeLogoImage(123)).toBe("");
    });
  });

  describe("safeText", () => {
    it("truncates text to specified maximum length", () => {
      expect(safeText("Hello World", 5)).toBe("Hello");
    });

    it("preserves Persian strings intact when within limit", () => {
      const text = "سامانه مدیریت مانور دپو";
      expect(safeText(text, 100)).toBe(text);
    });

    it("returns empty string for non-string inputs", () => {
      expect(safeText(null, 10)).toBe("");
      expect(safeText(undefined, 10)).toBe("");
      expect(safeText(12345, 10)).toBe("");
    });
  });
});
