// مهاجرت داده از JSON استخراج‌شده‌ی Access → SQLite، با هش امنِ bcrypt
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedDir = join(__dirname, "..", "seed");
const load = (n) =>
  JSON.parse(readFileSync(join(seedDir, n), "utf8").replace(/^﻿/, ""));

const prisma = new PrismaClient();

// رمزهای واقعیِ کشف‌شده از نسخه‌ی قدیمی (برای تداوم ورود). بقیه‌ی حساب‌ها: changeme123
const knownPasswords = {
  Admin: "Admin12345",
  mmm: "123",
  "99546": "99546",
  Hesam: "123456",
  mohamadjavad: "123456",
  ahmad: "123456",
  daryoush: "123456",
  Navgan: "123456",
  mehdiferdowsi: "changeme123",
};

async function main() {
  console.log("پاک‌سازی جداول…");
  await prisma.manovr.deleteMany();
  await prisma.train.deleteMany();
  await prisma.line.deleteMany();
  await prisma.personnel.deleteMany();

  // Personnel
  const personels = load("Personels.json");
  for (const p of personels) {
    let passwordHash = null;
    if (p.HasAccount && p.UserName) {
      const plain = knownPasswords[p.UserName] ?? "changeme123";
      passwordHash = await bcrypt.hash(plain, 10);
    }
    await prisma.personnel.create({
      data: {
        id: p.Id,
        firstName: p.FirstName ?? "",
        lastName: p.LastName ?? "",
        userName: p.UserName ?? null,
        passwordHash,
        role: p.Role ?? 0,
        shift: p.Shift ?? 1,
        orgPosition: p.OrganizationPosition ?? 1,
        workPlace: p.WorkPlace ?? 1,
        hasAccount: !!p.HasAccount,
        createdAt: p.CreatedAt ? new Date(p.CreatedAt) : new Date(),
      },
    });
  }
  console.log(`✓ ${personels.length} پرسنل`);

  // Lines
  const lines = load("Lines.json");
  for (const l of lines) {
    await prisma.line.create({
      data: {
        id: l.Id,
        name: l.Name ?? "",
        tag: l.Tag ?? null,
        capacity: l.Capacity ?? 1,
        terminal: l.Terminal ?? 1,
        isDynamic: !!l.IsDynamic,
      },
    });
  }
  console.log(`✓ ${lines.length} خط`);

  // Trains
  const lineIds = new Set(lines.map((l) => l.Id));
  const trains = load("Trains.json");
  for (const t of trains) {
    await prisma.train.create({
      data: {
        id: t.Id,
        code: String(t.Code ?? ""),
        type: t.Type ?? 0,
        isDisposed: !!t.IsDisposed,
        lineTag: t.LineTag ?? null,
        lineId: lineIds.has(t.Line_Id) ? t.Line_Id : null,
      },
    });
  }
  console.log(`✓ ${trains.length} قطار`);

  // Manovrs — تاریخ‌های نامعتبر (باگ 2647) پاک‌سازی می‌شوند
  const persIds = new Set(personels.map((p) => p.Id));
  const trainIds = new Set(trains.map((t) => t.Id));
  const safeDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    const y = d.getFullYear();
    if (isNaN(d.getTime()) || y < 2000 || y > 2100) return null;
    return d;
  };
  const manovrs = load("Manovrs.json");
  let ok = 0;
  for (const m of manovrs) {
    const created = safeDate(m.CreatedAt) ?? new Date();
    await prisma.manovr.create({
      data: {
        id: m.Id,
        type: m.Type ?? 1,
        status: m.Status ?? 1,
        confirmationStatus: m.ConfirmationStatus ?? 3,
        description: m.Description ?? null,
        createdAt: created,
        finishedAt: safeDate(m.FinishedAt),
        sourceLineId: lineIds.has(m.Source_Id) ? m.Source_Id : null,
        destinationLineId: lineIds.has(m.Destination_Id) ? m.Destination_Id : null,
        trainId: trainIds.has(m.Train_Id) ? m.Train_Id : null,
        rahbar1Id: persIds.has(m.Pesonel1_Id) ? m.Pesonel1_Id : null,
        rahbar2Id: persIds.has(m.Personel2_Id) ? m.Personel2_Id : null,
        creatorId: persIds.has(m.Personel_Id) ? m.Personel_Id : null,
      },
    });
    ok++;
  }
  console.log(`✓ ${ok} مانور`);
  console.log("مهاجرت کامل شد.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
