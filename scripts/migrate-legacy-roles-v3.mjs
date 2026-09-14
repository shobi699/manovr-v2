// Script to ensure all Personnel records have an assigned accessRoleId from V3 AccessRole
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEGACY_MAP = {
  1: "ادمین",
  2: "مسئول",
  3: "مشاهده",
  0: "بدون دسترسی",
  4: "تکنسین",
};

async function main() {
  console.log("Checking personnel records for missing accessRoleId...");

  // Fetch all access roles
  const accessRoles = await prisma.accessRole.findMany();
  const roleNameToId = new Map(accessRoles.map((r) => [r.name, r.id]));

  // Ensure default system roles exist
  const defaultRoles = [
    { name: "ادمین", permissions: "[\"*\"]", isSystem: true },
    { name: "مسئول", permissions: "[]", isSystem: true },
    { name: "مشاهده", permissions: "[]", isSystem: true },
    { name: "بدون دسترسی", permissions: "[]", isSystem: true },
  ];

  for (const dr of defaultRoles) {
    if (!roleNameToId.has(dr.name)) {
      const created = await prisma.accessRole.create({
        data: dr,
      });
      roleNameToId.set(dr.name, created.id);
      console.log(`Created missing system role: ${dr.name}`);
    }
  }

  // Find all personnel with accessRoleId: null
  const unassigned = await prisma.personnel.findMany({
    where: { accessRoleId: null },
    select: { id: true, userName: true, role: true, hasAccount: true },
  });

  console.log(`Found ${unassigned.length} personnel without accessRoleId.`);

  let updatedCount = 0;
  for (const p of unassigned) {
    const targetRoleName = LEGACY_MAP[p.role] || (p.hasAccount ? "مشاهده" : "بدون دسترسی");
    const targetRoleId = roleNameToId.get(targetRoleName) || roleNameToId.get("مشاهده") || roleNameToId.get("بدون دسترسی");

    if (targetRoleId) {
      await prisma.personnel.update({
        where: { id: p.id },
        data: { accessRoleId: targetRoleId },
      });
      updatedCount++;
    }
  }

  console.log(`Successfully migrated ${updatedCount} personnel to V3 access roles.`);
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
