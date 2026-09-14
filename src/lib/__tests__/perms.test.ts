import { describe, it, expect } from "vitest";
import { getRoleLevel, isRoleAllowedToManage, permsInclude, mapAccessRoleToLegacyRole } from "@/lib/perms";

describe("getRoleLevel", () => {
  it("returns 100 for super admin (role 4)", () => {
    expect(getRoleLevel(4)).toBe(100);
  });

  it("returns 80 for admin (role 1)", () => {
    expect(getRoleLevel(1)).toBe(80);
  });

  it("returns 50 for operator (role 2)", () => {
    expect(getRoleLevel(2)).toBe(50);
  });

  it("returns 30 for viewer (role 3)", () => {
    expect(getRoleLevel(3)).toBe(30);
  });

  it("returns 0 for guest (role 0)", () => {
    expect(getRoleLevel(0)).toBe(0);
  });

  it("returns 0 for an unknown role", () => {
    expect(getRoleLevel(99)).toBe(0);
  });
});

describe("isRoleAllowedToManage", () => {
  it("allows super admin to manage admin", () => {
    expect(isRoleAllowedToManage(4, 1)).toBe(true);
  });

  it("does not allow a peer to manage a peer", () => {
    expect(isRoleAllowedToManage(1, 1)).toBe(false);
  });

  it("does not allow a lower role to manage a higher role", () => {
    expect(isRoleAllowedToManage(2, 1)).toBe(false);
  });

  it("allows admin to manage guest", () => {
    expect(isRoleAllowedToManage(1, 0)).toBe(true);
  });
});

describe("permsInclude", () => {
  it("returns true when the permission is present", () => {
    expect(permsInclude(["manovr.view"], "manovr.view")).toBe(true);
  });

  it("returns false when the permission is absent", () => {
    expect(permsInclude([], "manovr.view")).toBe(false);
  });
});

describe("mapAccessRoleToLegacyRole", () => {
  it("maps admin roles correctly to 1", () => {
    expect(mapAccessRoleToLegacyRole("ادمین")).toBe(1);
    expect(mapAccessRoleToLegacyRole("مدیر سامانه")).toBe(1);
    expect(mapAccessRoleToLegacyRole("Admin")).toBe(1);
  });

  it("maps responsible/operator roles to 2", () => {
    expect(mapAccessRoleToLegacyRole("مسئول")).toBe(2);
    expect(mapAccessRoleToLegacyRole("مسئول شیفت")).toBe(2);
    expect(mapAccessRoleToLegacyRole("Operator")).toBe(2);
  });

  it("maps viewer roles to 3", () => {
    expect(mapAccessRoleToLegacyRole("مشاهده")).toBe(3);
    expect(mapAccessRoleToLegacyRole("کاربر بیننده")).toBe(3);
  });

  it("maps no access roles to 0", () => {
    expect(mapAccessRoleToLegacyRole("بدون دسترسی")).toBe(0);
    expect(mapAccessRoleToLegacyRole(null)).toBe(0);
    expect(mapAccessRoleToLegacyRole("")).toBe(0);
  });

  it("maps technician or superadmin roles to 4", () => {
    expect(mapAccessRoleToLegacyRole("تکنسین")).toBe(4);
    expect(mapAccessRoleToLegacyRole("سوپرادمین")).toBe(4);
  });
});

