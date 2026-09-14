import { describe, it, expect } from "vitest";
import {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  loginSchema,
  createTrainSchema,
  updateTrainSchema,
  createManovrSchema,
  confirmManovrSchema,
  createLineSchema,
  formatZodError,
} from "@/lib/validations";

describe("Validation Schemas (Zod)", () => {
  describe("User Schemas", () => {
    it("fails createUser when firstName is missing", () => {
      const parsed = createUserSchema.safeParse({
        lastName: "احمدی",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(formatZodError(parsed.error)).toContain("نام الزامی است");
      }
    });

    it("fails createUser when hasAccount is true but password is too short", () => {
      const parsed = createUserSchema.safeParse({
        firstName: "علی",
        lastName: "احمدی",
        hasAccount: "1",
        userName: "aliahmadi",
        password: "123",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(formatZodError(parsed.error)).toContain("حداقل ۴ کاراکتر");
      }
    });

    it("succeeds updateUser with valid data", () => {
      const parsed = updateUserSchema.safeParse({
        id: 5,
        firstName: "رضا",
        lastName: "محمدی",
        role: "2",
        shift: "3",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.id).toBe(5);
        expect(parsed.data.firstName).toBe("رضا");
        expect(parsed.data.role).toBe(2);
      }
    });

    it("succeeds createUser and updateUser with accessRoleId and without legacy role", () => {
      const createParsed = createUserSchema.safeParse({
        firstName: "مهدی",
        lastName: "فردوسی",
        hasAccount: "1",
        userName: "m_ferdowsi",
        password: "password123",
        accessRoleId: "2",
      });
      expect(createParsed.success).toBe(true);
      if (createParsed.success) {
        expect(createParsed.data.accessRoleId).toBe(2);
        expect(createParsed.data.role).toBe(0);
      }

      const updateParsed = updateUserSchema.safeParse({
        id: 12,
        firstName: "مهدی",
        lastName: "فردوسی",
        accessRoleId: "3",
      });
      expect(updateParsed.success).toBe(true);
      if (updateParsed.success) {
        expect(updateParsed.data.accessRoleId).toBe(3);
        expect(updateParsed.data.role).toBe(0);
      }
    });

    it("allows dynamic lookup codes >= 5 for orgPosition and shift without rejection", () => {
      const parsed = updateUserSchema.safeParse({
        id: 10,
        firstName: "مهندس",
        lastName: "صادقی",
        orgPosition: "15",
        shift: "5",
        personnelType: "2",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.orgPosition).toBe(15);
        expect(parsed.data.shift).toBe(5);
        expect(parsed.data.personnelType).toBe(2);
      }
    });

    it("succeeds createUser with valid data", () => {
      const parsed = createUserSchema.safeParse({
        firstName: "علی",
        lastName: "احمدی",
        hasAccount: "1",
        userName: "aliahmadi",
        password: "password123",
        role: "1",
        shift: "2",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.firstName).toBe("علی");
        expect(parsed.data.role).toBe(1);
        expect(parsed.data.shift).toBe(2);
        expect(parsed.data.hasAccount).toBe(true);
      }
    });

    it("validates reset password length", () => {
      const invalid = resetPasswordSchema.safeParse({
        userId: 1,
        password: "12",
      });
      expect(invalid.success).toBe(false);

      const valid = resetPasswordSchema.safeParse({
        userId: 1,
        password: "securePassword123",
      });
      expect(valid.success).toBe(true);
    });

    it("validates login credentials", () => {
      const invalid = loginSchema.safeParse({
        userName: "",
        password: "",
      });
      expect(invalid.success).toBe(false);

      const valid = loginSchema.safeParse({
        userName: "admin",
        password: "password",
      });
      expect(valid.success).toBe(true);
    });
  });

  describe("Train Schemas", () => {
    it("fails when code is missing", () => {
      const parsed = createTrainSchema.safeParse({
        type: "0",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(formatZodError(parsed.error)).toContain("کد قطار الزامی است");
      }
    });

    it("transforms movadDavvar and boolean flags cleanly", () => {
      const parsed = createTrainSchema.safeParse({
        code: "101",
        type: "0",
        hasKafshak: "1",
        noAtp: "true",
        movadDavvar: "A",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.code).toBe("101");
        expect(parsed.data.hasKafshak).toBe(true);
        expect(parsed.data.noAtp).toBe(true);
        expect(parsed.data.movadDavvar).toBe("A");
      }
    });

    it("succeeds updateTrain with valid input", () => {
      const parsed = updateTrainSchema.safeParse({
        id: "12",
        code: "105",
        type: "1",
        isDisposed: "false",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.id).toBe(12);
        expect(parsed.data.code).toBe("105");
        expect(parsed.data.isDisposed).toBe(false);
      }
    });
  });

  describe("Manovr Schemas", () => {
    it("fails when essential fields are absent", () => {
      const parsed = createManovrSchema.safeParse({
        type: 0,
      });
      expect(parsed.success).toBe(false);
    });

    it("succeeds with valid manovr payload", () => {
      const parsed = createManovrSchema.safeParse({
        type: 1,
        trainId: 10,
        rahbar1Id: 5,
        sourceLineId: 2,
        destinationLineId: 3,
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.type).toBe(1);
        expect(parsed.data.trainId).toBe(10);
        expect(parsed.data.rahbar1Id).toBe(5);
      }
    });

    it("validates confirmation payload", () => {
      const invalid = confirmManovrSchema.safeParse({
        id: 1,
        status: 5, // Only 1 or 2 allowed
      });
      expect(invalid.success).toBe(false);

      const valid = confirmManovrSchema.safeParse({
        id: 1,
        status: 1,
      });
      expect(valid.success).toBe(true);
    });
  });

  describe("Line Schemas", () => {
    it("fails when line name or terminal is missing", () => {
      const parsed = createLineSchema.safeParse({
        capacity: 2,
      });
      expect(parsed.success).toBe(false);
    });

    it("succeeds with valid line input", () => {
      const parsed = createLineSchema.safeParse({
        name: "خط تست ۱",
        capacity: "3",
        terminal: "1",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.name).toBe("خط تست ۱");
        expect(parsed.data.capacity).toBe(3);
      }
    });
  });
});
