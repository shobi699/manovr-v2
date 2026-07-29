// Seed v3: مختصات صحنه‌ی خطوط، نقش‌های سیستمی، جایگاه پارک قطارها
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const ALL_PERMS = [
  "manovr.view", "manovr.create", "manovr.edit", "manovr.confirm", "manovr.delete",
  "train.manage", "line.manage", "terminal.manage", "user.manage", "role.manage",
  "phonebook.view", "phonebook.edit", "report.build", "report.export", "report.import",
  "ticket.create", "ticket.manage", "lookups.manage", "branding.manage", "audit.view",
  "backup.manage", "settings.global", "depot.layout", "depot.view", "dashboard.view"
];

const SYSTEM_ROLES = [
  { name: "ادمین", permissions: ALL_PERMS, isSystem: true, legacy: 1 },
  {
    name: "مسئول",
    permissions: [
      "manovr.view", "manovr.create", "manovr.edit", "manovr.confirm", "manovr.delete",
      "train.manage", "line.manage", "terminal.manage", "user.manage",
      "phonebook.view", "report.build", "report.export", "ticket.create", "ticket.manage",
      "depot.view", "dashboard.view", "settings.global"
    ],
    isSystem: true, legacy: 2,
  },
  { name: "مشاهده", permissions: ["manovr.view", "phonebook.view", "report.build", "report.export", "depot.view", "dashboard.view"], isSystem: true, legacy: 3 },
  { name: "بدون دسترسی", permissions: [], isSystem: true, legacy: 0 },
];

async function seedRoles() {
  const map = new Map(); // legacy int -> accessRoleId
  for (const r of SYSTEM_ROLES) {
    const row = await prisma.accessRole.upsert({
      where: { name: r.name },
      update: { permissions: JSON.stringify(r.permissions), isSystem: true },
      create: { name: r.name, permissions: JSON.stringify(r.permissions), isSystem: true },
    });
    map.set(r.legacy, row.id);
  }
  // نگاشت پرسنل موجود به نقش سفارشی
  for (const [legacy, roleId] of map) {
    await prisma.personnel.updateMany({
      where: { role: legacy, accessRoleId: null },
      data: { accessRoleId: roleId },
    });
  }
  console.log("roles seeded:", map.size);
}

// چیدمان خودکار خطوط: هر ترمینال یک ناحیه، ریل‌ها موازی در امتداد محور Z
// ⚠️ باید با ZONE_CONFIG در src/lib/depot-visuals.ts همگام بماند.
// چیدمان RTL آینه‌ی گرید ۵-ستونه‌ی نمای دوبعدی:
//   ستون ۱ (راست‌ترین)  X=180  : پارکینگ جنوبی(بالا)/فرعی غرب(پایین)
//   ستون ۲               X=60   : پارکینگ شمالی(بالا)/فرعی شرق(پایین)
//   ستون ۳ (مرکز)        X=-60  : خط اصلی
//   ستون ۴               X=-180 : واگن‌سازی
//   ستون ۵ (چپ‌ترین)     X=-300 : دیزل‌شاپ
// عرض ستون‌ها گشاد شد تا سولهٔ عریض دیزل‌شاپ (18 خط) با همسایه‌اش برخورد نکند.
// فاصلهٔ ستون‌ها = 240 (بزرگ‌تر از حداکثر عرض سوله = 220) تا هیچ‌گاه همپوشانی نشود.
const ZONES = {
  5: { x:  480, z: -100, label: "پارکینگ جنوبی" },
  6: { x:  480, z:  100, label: "فرعی ۱ (غرب)" },
  4: { x:  240, z: -100, label: "پارکینگ شمالی" },
  7: { x:  240, z:  100, label: "فرعی ۲ (شرق)" },
  3: { x:    0, z: -100, label: "خط اصلی" },
  8: { x:    0, z:  100, label: "سایر خطوط" },
  2: { x: -240, z:    0, label: "واگن‌سازی" },
  1: { x: -480, z:    0, label: "دیزل‌شاپ" },
};
// ابعاد سولهٔ سه‌بعدی — عرض بر اساس تعداد خطوط پویا می‌شود.
// حداقل عرض ۹۰ ، حداکثر ۲۲۰. عمق ثابت.
const SHED_INNER_D_FULL = 160;
const SHED_INNER_D_HALF = 74;
const RAIL_STEP = 8;          // فاصله‌ی مطلوب بین دو ریل موازی
const SHED_PAD  = 12;         // حاشیه‌ی داخلی از دیوار سوله تا اولین ریل
const SHED_W_MIN = 90;
const SHED_W_MAX = 220;
const FULL_TERMINALS = new Set([1, 2]); // دیزل‌شاپ، واگن‌سازی — تمام‌ارتفاع

function shedWidthFor(lineCount) {
  const needed = SHED_PAD * 2 + Math.max(0, lineCount - 1) * RAIL_STEP;
  return Math.min(SHED_W_MAX, Math.max(SHED_W_MIN, needed));
}

// نگاشت الگوی نام خط → ترمینال درست
// (اسم‌ها از seed/Lines.json و کد فعلی نمای دوبعدی استخراج شده‌اند)
const NAME_TO_TERMINAL = [
  { rx: /^خط اصلی$/,                                        t: 3 },
  // فرعی شرق (سمت پارکینگ شمالی)
  { rx: /^(متروواش|پیتلاین|مجاور\s?سوله|مجاور\s?مرکز)/,    t: 7 },
  // فرعی غرب (سمت پارکینگ جنوبی)
  { rx: /^(دوار\s?(غربی|شرقی)|آبگیری|خط\s?کور\s?2)/,       t: 6 },
  // واگن‌سازی
  { rx: /^واگن\s?سازی/,                                     t: 2 },
  { rx: /^(بادگیری|خط\s?کور\s?1)$/,                         t: 2 },
  // دیزل‌شاپ
  { rx: /^دیزل\s?شاپ/,                                      t: 1 },
  { rx: /^(خط\s?تست|D7G|باطری\s?خانه|کارخانه)/,             t: 1 },
  // پارکینگ‌ها
  { rx: /^پارکینگ\s?شمالی/,                                 t: 4 },
  { rx: /^پارکینگ\s?جنوبی/,                                 t: 5 },
];

function terminalForName(name) {
  for (const rule of NAME_TO_TERMINAL) {
    if (rule.rx.test(name)) return rule.t;
  }
  return null;
}

// اصلاح ترمینال هر خط بر اساس نامش (اگر با انتظار ما نمی‌خواند)
async function fixTerminals() {
  const lines = await prisma.line.findMany();
  let fixed = 0;
  const validTerminals = new Set(Object.keys(ZONES).map(Number));
  for (const l of lines) {
    const byName = terminalForName(l.name);
    let target = byName;
    // اگر ترمینال فعلی نامعتبر است (مثل ۸)، به خط اصلی منتقل کن
    if (target === null && !validTerminals.has(l.terminal)) {
      target = 3;
    }
    if (target !== null && target !== l.terminal) {
      await prisma.line.update({ where: { id: l.id }, data: { terminal: target } });
      fixed++;
    }
  }
  console.log("terminals fixed:", fixed, "/", lines.length);
}

async function seedLayout() {
  const force = process.env.FORCE_LAYOUT === "1";
  const lines = await prisma.line.findMany({ orderBy: [{ terminal: "asc" }, { name: "asc" }] });

  // گروه‌بندی خطوط بر اساس ترمینال
  const groups = new Map();
  for (const l of lines) {
    if (!groups.has(l.terminal)) groups.set(l.terminal, []);
    groups.get(l.terminal).push(l);
  }

  let updated = 0;
  for (const [terminalId, group] of groups) {
    const zone = ZONES[terminalId];
    if (!zone) continue;

    const isFull = FULL_TERMINALS.has(terminalId);
    const railLen = isFull ? SHED_INNER_D_FULL : SHED_INNER_D_HALF;

    // مرتب‌سازی ثابت داخل سوله: خطوط عددی به ترتیب عدد، بقیه الفبایی
    const sorted = [...group].sort((a, b) => {
      const na = extractIndex(a.name);
      const nb = extractIndex(b.name);
      if (na != null && nb != null) return na - nb;
      if (na != null) return -1;
      if (nb != null) return 1;
      return a.name.localeCompare(b.name, "fa");
    });

    const n = sorted.length;
    const shedW = shedWidthFor(n);
    const innerW = shedW - SHED_PAD * 2;
    const step = n > 1 ? innerW / (n - 1) : 0;
    const startX = zone.x - innerW / 2;

    for (let i = 0; i < n; i++) {
      const l = sorted[i];
      if (!force && (l.posX !== 0 || l.posY !== 0)) continue;

      await prisma.line.update({
        where: { id: l.id },
        data: {
          posX: n === 1 ? zone.x : startX + i * step,
          posY: zone.z, // مرکز عمقی سوله
          rotation: 0,   // همه‌ی ریل‌ها در امتداد Z
          length: railLen,
          sortIdx: i,
        },
      });
      updated++;
    }
  }
  console.log("layout seeded:", updated, "/", lines.length, force ? "(FORCE)" : "");
}

function extractIndex(name) {
  const m = name.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

async function seedSlots() {
  // قطارهای روی هر خط را در اسلات‌های 0..n بچین
  const lines = await prisma.line.findMany({ include: { trains: { where: { isDisposed: false } } } });
  for (const l of lines) {
    let i = 0;
    for (const t of l.trains) {
      await prisma.train.update({ where: { id: t.id }, data: { slotIndex: i++ } });
    }
  }
  console.log("slots seeded");
}

const LOOKUPS = {
  manovr_type: {
    label: "نوع مانور",
    values: [
      { code: 1, label: "دیزل", color: "#64748b" },
      { code: 2, label: "انتقال قطار", color: "#3b82f6" },
      { code: 3, label: "تارواش / مثلث", color: "#10b981" },
      { code: 4, label: "استاتیک", color: "#f59e0b", meta: JSON.stringify({ isStatic: true }) },
      { code: 5, label: "تست خط", color: "#8b5cf6" },
      { code: 6, label: "تست حرکت", color: "#ec4899" },
      { code: 7, label: "دوار", color: "#14b8a6" },
      { code: 8, label: "تست خط اصلی", color: "#f43f5e" },
      { code: 9, label: "انتقال به واگن‌سازی", color: "#6366f1" },
      { code: 10, label: "بین خطوط", color: "#a855f7" },
      { code: 11, label: "بادگیری", color: "#06b6d4" },
      { code: 12, label: "خط اصلی دیزل", color: "#0f172a" },
      { code: 13, label: "ورودی شهرری", color: "#1e293b" },
      { code: 14, label: "ورودی کهریزک", color: "#334155" },
      { code: 15, label: "ورودی شهرآفتاب", color: "#475569" },
      { code: 16, label: "خروجی شهرری", color: "#0284c7" },
      { code: 17, label: "خروجی کهریزک", color: "#0369a1" },
      { code: 18, label: "خروجی شهرآفتاب", color: "#075985" },
      { code: 19, label: "تعویض قطار", color: "#ca8a04" },
      { code: 20, label: "تعویض کفشک", color: "#eab308", meta: JSON.stringify({ isStatic: true }) },
      { code: 21, label: "انتقال دائم به سایر خطوط", color: "#dc2626", meta: JSON.stringify({ isPermanent: true }) },
      { code: 22, label: "انتقال دائم به واگن‌سازی", color: "#ea580c", meta: JSON.stringify({ isPermanent: true }) },
      { code: 23, label: "سایر انتقال‌های دائم", color: "#b91c1c", meta: JSON.stringify({ isPermanent: true }) },
    ]
  },
  manovr_status: {
    label: "وضعیت مانور",
    values: [
      { code: 1, label: "شروع‌شده", color: "#e5a24a" },
      { code: 2, label: "پایان‌یافته", color: "#10b981" },
      { code: 3, label: "حذف‌شده", color: "#ef4444" },
    ]
  },
  confirmation_status: {
    label: "وضعیت تأییدیه",
    values: [
      { code: 1, label: "تأیید", color: "#10b981" },
      { code: 2, label: "رد", color: "#ef4444" },
      { code: 3, label: "بدون تأیید", color: "#6b7280" },
    ]
  },
  role: {
    label: "نقش عمومی",
    values: [
      { code: 0, label: "بدون دسترسی", color: "#6b7280" },
      { code: 1, label: "ادمین", color: "#ef4444" },
      { code: 2, label: "مسئول", color: "#f59e0b" },
      { code: 3, label: "مشاهده", color: "#3b82f6" },
    ]
  },
  org_position: {
    label: "سمت پرسنلی",
    values: [
      { code: 1, label: "راهبر", color: "#10b981" },
      { code: 2, label: "مسئول", color: "#f59e0b" },
      { code: 3, label: "ادمین", color: "#ef4444" },
      { code: 4, label: "سایر", color: "#6b7280" },
    ]
  },
  terminal: {
    label: "ترمینال‌های پایانه",
    values: [
      { code: 1, label: "دیزل‌شاپ", color: "#ef4444", meta: JSON.stringify({ x: -480, z: 0, gridCol: 5, gridRow: "full" }) },
      { code: 2, label: "واگن‌سازی", color: "#f59e0b", meta: JSON.stringify({ x: -240, z: 0, gridCol: 4, gridRow: "full" }) },
      { code: 3, label: "خط اصلی", color: "#64748b", meta: JSON.stringify({ x: 0, z: -100, gridCol: 3, gridRow: "top" }) },
      { code: 4, label: "پارکینگ شمالی", color: "#3b82f6", meta: JSON.stringify({ x: 240, z: -100, gridCol: 2, gridRow: "top" }) },
      { code: 5, label: "پارکینگ جنوبی", color: "#06b6d4", meta: JSON.stringify({ x: 480, z: -100, gridCol: 1, gridRow: "top" }) },
      { code: 6, label: "فرعی ۱", color: "#8b5cf6", meta: JSON.stringify({ x: 480, z: 100, gridCol: 1, gridRow: "bottom" }) },
      { code: 7, label: "فرعی ۲", color: "#ec4899", meta: JSON.stringify({ x: 240, z: 100, gridCol: 2, gridRow: "bottom" }) },
      { code: 8, label: "سایر خطوط", color: "#475569", meta: JSON.stringify({ x: 0, z: 100, gridCol: 3, gridRow: "bottom" }) },
    ]
  },
  train_type: {
    label: "نوع ناوگان",
    values: [
      { code: 0, label: "AC (مترویی)", color: "#3b82f6" },
      { code: 1, label: "DC (دیزلی)", color: "#10b981" },
    ]
  },
  shift: {
    label: "شیفت‌های کاری",
    values: [
      { code: 1, label: "A", color: "#3b82f6" },
      { code: 2, label: "B", color: "#10b981" },
      { code: 3, label: "C", color: "#f59e0b" },
    ]
  }
};

async function seedLookups() {
  for (const [key, item] of Object.entries(LOOKUPS)) {
    const type = await prisma.lookupType.upsert({
      where: { key },
      update: { label: item.label, isSystem: true },
      create: { key, label: item.label, isSystem: true },
    });
    
    // واکشی کدهای معتبر از لیست تعاریف جدید
    const activeCodes = item.values.map(v => v.code);
    
    // غیرفعال کردن مواردی که دیگر معتبر نیستند (مانند کد ۸ برای ترمینال)
    await prisma.lookupValue.updateMany({
      where: {
        typeId: type.id,
        code: { notIn: activeCodes }
      },
      data: { isActive: false }
    });

    for (const v of item.values) {
      await prisma.lookupValue.upsert({
        where: {
          typeId_code: {
            typeId: type.id,
            code: v.code
          }
        },
        update: { label: v.label, color: v.color, isActive: true, meta: v.meta || "{}" },
        create: {
          typeId: type.id,
          code: v.code,
          label: v.label,
          color: v.color,
          isActive: true,
          meta: v.meta || "{}"
        }
      });
    }
  }
  console.log("lookups seeded");
}

seedRoles()
  .then(fixTerminals)
  .then(seedLayout)
  .then(seedSlots)
  .then(seedLookups)
  .then(() => prisma.$disconnect());

