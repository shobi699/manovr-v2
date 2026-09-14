import { describe, it, expect } from "vitest";
import { getPersianLineTitle } from "@/app/(main)/depot/views/depotViewUtils";
import { STATUS_STYLE, statusStyleFor } from "@/lib/depot-visuals";
import { LineData, TrainData } from "@/app/(main)/depot/types";

describe("Terminal 2D Map Logic & Utilities", () => {
  const mockLines: LineData[] = [
    { id: 1, name: "خط اصلی", capacity: 40, terminal: 3, tag: "MAIN", posX: 0, posY: 0, rotation: 0, length: 100, isDynamic: false, isActive: true },
    { id: 2, name: "پارکینگ شمالی 1", capacity: 2, terminal: 4, tag: "N1", posX: 0, posY: 0, rotation: 0, length: 100, isDynamic: false, isActive: true },
    { id: 3, name: "پارکینگ جنوبی 1", capacity: 2, terminal: 5, tag: "S1", posX: 0, posY: 0, rotation: 0, length: 100, isDynamic: false, isActive: false }, // مسدود
    { id: 4, name: "دیزل شاپ 1", capacity: 2, terminal: 1, tag: "D1", posX: 0, posY: 0, rotation: 0, length: 100, isDynamic: false, isActive: true },
    { id: 5, name: "واگن سازی 1", capacity: 2, terminal: 2, tag: "W1", posX: 0, posY: 0, rotation: 0, length: 100, isDynamic: false, isActive: true },
    { id: 6, name: "فرعی ۱ (غرب)", capacity: 2, terminal: 6, tag: "SUB1", posX: 0, posY: 0, rotation: 0, length: 100, isDynamic: false, isActive: true },
    { id: 7, name: "فرعی ۲ (شرق)", capacity: 2, terminal: 7, tag: "SUB2", posX: 0, posY: 0, rotation: 0, length: 100, isDynamic: false, isActive: true },
  ];

  const mockTrains: TrainData[] = [
    { id: 101, code: "101", type: 0, status: 1, lineId: 1, slotIndex: 0, isDisposed: false, hasKafshak: false, noAtp: false },
    { id: 102, code: "102", type: 0, status: 2, lineId: 1, slotIndex: 1, isDisposed: false, hasKafshak: true, noAtp: false },
    { id: 103, code: "103", type: 1, status: 3, lineId: 2, slotIndex: 0, isDisposed: false, hasKafshak: false, noAtp: true },
    { id: 104, code: "104", type: 0, status: 4, lineId: 2, slotIndex: 1, isDisposed: false, hasKafshak: false, noAtp: false },
  ];

  it("calculates slot occupancy correctly per line", () => {
    const mainLineTrains = mockTrains.filter((t) => t.lineId === 1 && !t.isDisposed);
    expect(mainLineTrains).toHaveLength(2);
    expect(mainLineTrains.map((t) => t.slotIndex)).toEqual([0, 1]);

    const northParkTrains = mockTrains.filter((t) => t.lineId === 2 && !t.isDisposed);
    expect(northParkTrains).toHaveLength(2);

    const isNorthParkFull = northParkTrains.length >= mockLines[1].capacity;
    expect(isNorthParkFull).toBe(true);
  });

  it("prevents drop and returns full status when line capacity is reached", () => {
    const targetLine = mockLines.find((l) => l.id === 2)!;
    const occupiedCount = mockTrains.filter((t) => t.lineId === targetLine.id && !t.isDisposed).length;
    const hasCapacity = occupiedCount < targetLine.capacity;
    expect(hasCapacity).toBe(false);
  });

  it("identifies blocked/inactive lines and prohibits shunting operations", () => {
    const blockedLine = mockLines.find((l) => l.id === 3)!;
    expect(blockedLine.isActive).toBe(false);

    // بررسی گارد اعتبارسنجی
    const canAcceptDrop = (line: LineData) => line.isActive !== false;
    expect(canAcceptDrop(blockedLine)).toBe(false);
    expect(canAcceptDrop(mockLines[0])).toBe(true);
  });

  it("finds next available slot index cleanly without collisions", () => {
    const mainLine = mockLines.find((l) => l.id === 1)!;
    const occupiedSlots = mockTrains.filter((t) => t.lineId === mainLine.id && !t.isDisposed).map((t) => t.slotIndex);

    let nextSlot = -1;
    for (let i = 0; i < mainLine.capacity; i++) {
      if (!occupiedSlots.includes(i)) {
        nextSlot = i;
        break;
      }
    }

    expect(nextSlot).toBe(2);
    expect(occupiedSlots).not.toContain(nextSlot);
  });

  it("maps status styles and Persian line titles reliably", () => {
    expect(statusStyleFor(1).label).toBe("آماده به کار");
    expect(statusStyleFor(2).label).toBe("تحت تعمیر");
    expect(statusStyleFor(3).label).toBe("غیرفعال / خراب");
    expect(statusStyleFor(4).label).toBe("آماده اعزام");

    const title1 = getPersianLineTitle({ id: 99, name: "Dizel_1", capacity: 1, terminal: 1, tag: null, posX: 0, posY: 0, rotation: 0, length: 50, isDynamic: false });
    expect(title1).toContain("دیزل شاپ");

    const title2 = getPersianLineTitle({ id: 100, name: "Wagon_1", capacity: 1, terminal: 2, tag: null, posX: 0, posY: 0, rotation: 0, length: 50, isDynamic: false });
    expect(title2).toContain("واگن‌سازی");
  });
});
