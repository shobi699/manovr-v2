const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const systemUser = await prisma.personnel.findUnique({
    where: { id: 0 }
  });
  if (!systemUser) {
    await prisma.personnel.create({
      data: {
        id: 0,
        firstName: "سیستم",
        lastName: "مدیریت",
        role: 0,
        hasAccount: false,
      }
    });
    console.log("System user (id: 0) created successfully.");
  } else {
    console.log("System user (id: 0) already exists.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
