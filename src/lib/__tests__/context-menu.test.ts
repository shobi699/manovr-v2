import { describe, it, expect } from "vitest";
import { ContextMenuItem, ContextMenuGroup } from "@/components/context-menu/types";

describe("Global & Contextual Right-Click Engine", () => {
  it("defines standard context menu item schema properly", () => {
    const item: ContextMenuItem = {
      id: "test-item",
      label: "آزمون منو",
      shortcut: "Ctrl+T",
      badge: "فعال",
      badgeVariant: "good",
      onClick: () => {},
    };

    expect(item.id).toBe("test-item");
    expect(item.label).toBe("آزمون منو");
    expect(item.shortcut).toBe("Ctrl+T");
    expect(item.badgeVariant).toBe("good");
  });

  it("organizes items into structured context menu groups", () => {
    const group: ContextMenuGroup = {
      id: "depot_tools",
      title: "ابزارهای تعاملی پایانه دپو",
      items: [
        {
          id: "track-lock",
          label: "قفل ریل",
          onClick: () => {},
        },
        {
          id: "quick-manovr",
          label: "ثبت مانور",
          onClick: () => {},
        },
      ],
    };

    expect(group.id).toBe("depot_tools");
    expect(group.items).toHaveLength(2);
    expect(group.items[0].id).toBe("track-lock");
  });

  it("computes collision detection coordinates correctly within viewport boundaries", () => {
    const calculateBounds = (
      clickX: number,
      clickY: number,
      menuW: number,
      menuH: number,
      windowW: number,
      windowH: number,
      padding = 12
    ) => {
      let x = clickX;
      let y = clickY;

      if (x + menuW > windowW - padding) {
        x = Math.max(padding, windowW - menuW - padding);
      }
      if (x < padding) {
        x = padding;
      }
      if (y + menuH > windowH - padding) {
        y = Math.max(padding, windowH - menuH - padding);
      }
      if (y < padding) {
        y = padding;
      }

      return { x, y };
    };

    // سناریو ۱: کلیک در وسط صفحه
    const normal = calculateBounds(400, 300, 260, 300, 1920, 1080);
    expect(normal.x).toBe(400);
    expect(normal.y).toBe(300);

    // سناریو ۲: کلیک در لبه سمت راست نزدیک مرز صفحه (برخورد افقی)
    const rightEdge = calculateBounds(1900, 400, 260, 300, 1920, 1080);
    expect(rightEdge.x).toBe(1920 - 260 - 12);
    expect(rightEdge.y).toBe(400);

    // سناریو ۳: کلیک در لبه پایینی صفحه (برخورد عمودی)
    const bottomEdge = calculateBounds(500, 1050, 260, 300, 1920, 1080);
    expect(bottomEdge.x).toBe(500);
    expect(bottomEdge.y).toBe(1080 - 300 - 12);

    // سناریو ۴: کلیک در گوشه پایین راست (برخورد هر دو جهت)
    const corner = calculateBounds(1910, 1070, 260, 300, 1920, 1080);
    expect(corner.x).toBe(1920 - 260 - 12);
    expect(corner.y).toBe(1080 - 300 - 12);
  });

  it("executes item action prior to closing menu in deterministic order", () => {
    const executionOrder: string[] = [];
    let stoppedPropagation = false;
    let preventedDefault = false;

    const mockAction = () => {
      executionOrder.push("ACTION_EXECUTED");
    };

    const mockClose = () => {
      executionOrder.push("MENU_CLOSED");
    };

    const handleItemClick = (
      e: { preventDefault: () => void; stopPropagation: () => void },
      item: ContextMenuItem,
      onClose: () => void
    ) => {
      e.preventDefault();
      e.stopPropagation();
      if (item.disabled) return;
      if (typeof item.onClick === "function") {
        item.onClick();
      }
      onClose();
    };

    const mockEvent = {
      preventDefault: () => {
        preventedDefault = true;
      },
      stopPropagation: () => {
        stoppedPropagation = true;
      },
    };

    const item: ContextMenuItem = {
      id: "action-test",
      label: "تست اقدام عملیاتی",
      onClick: mockAction,
    };

    handleItemClick(mockEvent, item, mockClose);

    // بررسی توقف انتشار رویداد جهت عدم فعال‌سازی لیسنرهای خارج منو
    expect(preventedDefault).toBe(true);
    expect(stoppedPropagation).toBe(true);

    // بررسی ترتیب قطعی: ابتدا اکشن اجرا می‌شود و سپس منو بسته می‌شود
    expect(executionOrder).toEqual(["ACTION_EXECUTED", "MENU_CLOSED"]);
  });

  it("does not execute action or close menu when item is disabled", () => {
    let actionCalled = false;
    let closeCalled = false;

    const handleItemClick = (
      e: { preventDefault: () => void; stopPropagation: () => void },
      item: ContextMenuItem,
      onClose: () => void
    ) => {
      e.preventDefault();
      e.stopPropagation();
      if (item.disabled) return;
      if (typeof item.onClick === "function") {
        item.onClick();
      }
      onClose();
    };

    const mockEvent = {
      preventDefault: () => {},
      stopPropagation: () => {},
    };

    const disabledItem: ContextMenuItem = {
      id: "disabled-test",
      label: "آیتم غیرفعال",
      disabled: true,
      onClick: () => {
        actionCalled = true;
      },
    };

    handleItemClick(mockEvent, disabledItem, () => {
      closeCalled = true;
    });

    expect(actionCalled).toBe(false);
    expect(closeCalled).toBe(false);
  });

  it("supports keyboard triggers via Enter and Space for accessibility", () => {
    const keysTested: string[] = [];

    const handleItemKeyDown = (
      e: { key: string; preventDefault: () => void; stopPropagation: () => void },
      item: ContextMenuItem,
      onClose: () => void
    ) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        if (item.disabled) return;
        if (typeof item.onClick === "function") {
          item.onClick();
        }
        onClose();
      }
    };

    const testWithKey = (key: string) => {
      let actionExecuted = false;
      let menuClosed = false;

      const item: ContextMenuItem = {
        id: `key-test-${key}`,
        label: "تست کلید",
        onClick: () => {
          actionExecuted = true;
        },
      };

      const mockEvent = {
        key,
        preventDefault: () => {},
        stopPropagation: () => {},
      };

      handleItemKeyDown(mockEvent, item, () => {
        menuClosed = true;
      });

      if (actionExecuted && menuClosed) {
        keysTested.push(key);
      }
    };

    // تست کلید اینتر
    testWithKey("Enter");
    // تست کلید اسپیس
    testWithKey(" ");
    // تست کلید دیگر (نباید اجرا شود)
    testWithKey("ArrowDown");

    expect(keysTested).toEqual(["Enter", " "]);
  });

  it("correctly identifies outside vs inside click target boundaries", () => {
    // شبیه‌سازی ساختار DOM
    const menuContainer = {
      id: "context-menu-container",
      contains: (target: { id: string }) => {
        return target.id === "menu-item" || target.id === "context-menu-container";
      },
    };

    const isInside = (target: { id: string }) => {
      return menuContainer.contains(target);
    };

    // کلیک روی دکمه داخل منو: باید درون منو تشخیص داده شود (بستن نابهنگام رخ ندهد)
    expect(isInside({ id: "menu-item" })).toBe(true);

    // کلیک روی ریل یا پس‌زمینه بیرونی: باید خارج منو تشخیص داده شود
    expect(isInside({ id: "depot-canvas" })).toBe(false);
    expect(isInside({ id: "sidebar" })).toBe(false);
  });
});
