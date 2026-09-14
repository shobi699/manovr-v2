import { describe, it, expect } from "vitest";

describe("Shunting Reports & Analytics Logic", () => {
  interface MockManovr {
    id: number;
    rahbar1Id: number | null;
    rahbar2Id: number | null;
    rahbar1?: {
      id: number;
      firstName: string;
      lastName: string;
      shift: number;
    } | null;
    executionTime: string;
  }

  const sampleManovrs: MockManovr[] = [
    // راننده ۱ (شیفت A): ۲ مانور سولو، ۱ مانور با کمکی
    {
      id: 1,
      rahbar1Id: 101,
      rahbar2Id: null,
      rahbar1: { id: 101, firstName: "علی", lastName: "رضایی", shift: 1 },
      executionTime: "2026-09-10T08:30:00.000Z",
    },
    {
      id: 2,
      rahbar1Id: 101,
      rahbar2Id: null,
      rahbar1: { id: 101, firstName: "علی", lastName: "رضایی", shift: 1 },
      executionTime: "2026-09-10T11:15:00.000Z",
    },
    {
      id: 3,
      rahbar1Id: 101,
      rahbar2Id: 102,
      rahbar1: { id: 101, firstName: "علی", lastName: "رضایی", shift: 1 },
      executionTime: "2026-09-11T09:00:00.000Z",
    },
    // راننده ۲ (شیفت B): ۱ مانور سولو، ۲ مانور با کمکی
    {
      id: 4,
      rahbar1Id: 102,
      rahbar2Id: null,
      rahbar1: { id: 102, firstName: "رضا", lastName: "محمدی", shift: 2 },
      executionTime: "2026-09-12T16:00:00.000Z",
    },
    {
      id: 5,
      rahbar1Id: 102,
      rahbar2Id: 103,
      rahbar1: { id: 102, firstName: "رضا", lastName: "محمدی", shift: 2 },
      executionTime: "2026-09-12T18:30:00.000Z",
    },
    {
      id: 6,
      rahbar1Id: 102,
      rahbar2Id: 101,
      rahbar1: { id: 102, firstName: "رضا", lastName: "محمدی", shift: 2 },
      executionTime: "2026-09-13T17:00:00.000Z",
    },
    // راننده ۳ (شیفت C): ۲ مانور سولو
    {
      id: 7,
      rahbar1Id: 103,
      rahbar2Id: null,
      rahbar1: { id: 103, firstName: "حسین", lastName: "حسینی", shift: 3 },
      executionTime: "2026-09-13T23:45:00.000Z",
    },
    {
      id: 8,
      rahbar1Id: 103,
      rahbar2Id: null,
      rahbar1: { id: 103, firstName: "حسین", lastName: "حسینی", shift: 3 },
      executionTime: "2026-09-14T02:15:00.000Z",
    },
    // راننده ۴ (شیفت D): ۱ مانور سولو
    {
      id: 9,
      rahbar1Id: 104,
      rahbar2Id: null,
      rahbar1: { id: 104, firstName: "مهدی", lastName: "کریمی", shift: 4 },
      executionTime: "2026-09-14T10:00:00.000Z",
    },
  ];

  describe("Solo Shunting Calculation", () => {
    it("correctly identifies solo operations where rahbar2Id is null", () => {
      const soloItems = sampleManovrs.filter((m) => m.rahbar1Id !== null && m.rahbar2Id === null);
      expect(soloItems.length).toBe(6);
      expect(soloItems.map((s) => s.id)).toEqual([1, 2, 4, 7, 8, 9]);
    });

    it("correctly identifies assisted operations where rahbar2Id is present", () => {
      const assistedItems = sampleManovrs.filter((m) => m.rahbar2Id !== null);
      expect(assistedItems.length).toBe(3);
      expect(assistedItems.map((s) => s.id)).toEqual([3, 5, 6]);
    });

    it("accurately calculates solo percentage per driver", () => {
      // راننده ۱۰۱: ۳ مانور (۲ سولو = ۶۷٪)
      const driver101Shunts = sampleManovrs.filter((m) => m.rahbar1Id === 101);
      const solo101 = driver101Shunts.filter((m) => m.rahbar2Id === null).length;
      const pct101 = Math.round((solo101 / driver101Shunts.length) * 100);
      expect(solo101).toBe(2);
      expect(pct101).toBe(67);

      // راننده ۱۰۲: ۳ مانور (۱ سولو = ۳۳٪)
      const driver102Shunts = sampleManovrs.filter((m) => m.rahbar1Id === 102);
      const solo102 = driver102Shunts.filter((m) => m.rahbar2Id === null).length;
      const pct102 = Math.round((solo102 / driver102Shunts.length) * 100);
      expect(solo102).toBe(1);
      expect(pct102).toBe(33);

      // راننده ۱۰۳: ۲ مانور (۲ سولو = ۱۰۰٪)
      const driver103Shunts = sampleManovrs.filter((m) => m.rahbar1Id === 103);
      const solo103 = driver103Shunts.filter((m) => m.rahbar2Id === null).length;
      const pct103 = Math.round((solo103 / driver103Shunts.length) * 100);
      expect(solo103).toBe(2);
      expect(pct103).toBe(100);
    });
  });

  describe("Shift-based Aggregation (Shifts A, B, C, D)", () => {
    it("aggregates shunting operations by shift", () => {
      const shiftCounts = { A: 0, B: 0, C: 0, D: 0 };

      sampleManovrs.forEach((m) => {
        const s = m.rahbar1?.shift;
        if (s === 1) shiftCounts.A++;
        else if (s === 2) shiftCounts.B++;
        else if (s === 3) shiftCounts.C++;
        else if (s === 4) shiftCounts.D++;
      });

      expect(shiftCounts.A).toBe(3);
      expect(shiftCounts.B).toBe(3);
      expect(shiftCounts.C).toBe(2);
      expect(shiftCounts.D).toBe(1);
      expect(shiftCounts.A + shiftCounts.B + shiftCounts.C + shiftCounts.D).toBe(9);
    });

    it("filters operations by specific shift", () => {
      const shiftBOnly = sampleManovrs.filter((m) => m.rahbar1?.shift === 2);
      expect(shiftBOnly.length).toBe(3);
      expect(shiftBOnly.every((m) => m.rahbar1Id === 102)).toBe(true);

      const shiftDOnly = sampleManovrs.filter((m) => m.rahbar1?.shift === 4);
      expect(shiftDOnly.length).toBe(1);
      expect(shiftDOnly[0].id).toBe(9);
    });
  });

  describe("Periodic Grouping in Persian / Tehran Calendar", () => {
    it("formats daily dates in Jalali calendar", () => {
      const d = new Date("2026-09-14T10:00:00.000Z");
      const formatted = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        timeZone: "Asia/Tehran",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);

      // ۱۴۰۵/۰۶/۲۳ or ۱۴۰۵/۰۶/۲۴ depending on hour
      expect(formatted).toMatch(/[۰-۹]{4}\/[۰-۹]{2}\/[۰-۹]{2}/);
    });

    it("formats monthly period in Persian text", () => {
      const d = new Date("2026-09-14T10:00:00.000Z");
      const formatted = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        timeZone: "Asia/Tehran",
        year: "numeric",
        month: "long",
      }).format(d);

      expect(formatted).toContain("شهریور");
    });
  });

  describe("Part-Time Driver Reporting & Performance Matrix", () => {
    interface ExtendedMockManovr {
      id: number;
      rahbar1Id: number | null;
      rahbar2Id: number | null;
      rahbar1?: {
        id: number;
        firstName: string;
        lastName: string;
        shift: number;
        isPartTimeDriver?: boolean;
        orgPosition?: number;
      } | null;
      executionTime: string;
    }

    const extendedManovrs: ExtendedMockManovr[] = [
      ...sampleManovrs,
      {
        id: 10,
        rahbar1Id: 201,
        rahbar2Id: null,
        rahbar1: { id: 201, firstName: "محمد", lastName: "حیدری", shift: 1, isPartTimeDriver: true, orgPosition: 2 },
        executionTime: "2026-09-14T14:00:00.000Z",
      },
      {
        id: 11,
        rahbar1Id: 201,
        rahbar2Id: 101,
        rahbar1: { id: 201, firstName: "محمد", lastName: "حیدری", shift: 1, isPartTimeDriver: true, orgPosition: 2 },
        executionTime: "2026-09-14T16:30:00.000Z",
      },
    ];

    it("includes part-time drivers in total operations and shunts count", () => {
      const partTimeDriverShunts = extendedManovrs.filter((m) => m.rahbar1?.isPartTimeDriver);
      expect(partTimeDriverShunts.length).toBe(2);
      expect(partTimeDriverShunts.map((s) => s.id)).toEqual([10, 11]);
    });

    it("calculates solo vs assisted shunts accurately for part-time drivers", () => {
      const ptShunts = extendedManovrs.filter((m) => m.rahbar1Id === 201);
      const solo = ptShunts.filter((m) => m.rahbar2Id === null).length;
      const assisted = ptShunts.filter((m) => m.rahbar2Id !== null).length;
      expect(solo).toBe(1);
      expect(assisted).toBe(1);
      expect(Math.round((solo / ptShunts.length) * 100)).toBe(50);
    });

    it("filters reports by regular vs part-time driver type", () => {
      const regularDriversOnly = extendedManovrs.filter((m) => !m.rahbar1?.isPartTimeDriver);
      const partTimeDriversOnly = extendedManovrs.filter((m) => m.rahbar1?.isPartTimeDriver === true);
      expect(regularDriversOnly.length).toBe(9);
      expect(partTimeDriversOnly.length).toBe(2);
    });
  });
});
