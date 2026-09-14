import { prisma } from "@/lib/prisma";

export interface ReportFilter {
  field: string;
  operator: "equals" | "notEquals" | "contains" | "gt" | "lt" | "between";
  value: string;
  value2?: string;
}

export interface ReportConfig {
  entity: "manovr" | "train" | "line" | "personnel";
  fields: string[];
  filters: ReportFilter[];
  groupBy?: string;
  chart?: "table" | "bar" | "pie" | "line";
  sortField?: string;
  sortDirection?: "asc" | "desc";
}

// ستون‌های مجاز پرسنل برای ارسال به کلاینت و خروجی گزارش‌ها.
// passwordHash عمداً حذف شده است و هرگز نباید اضافه شود.
export const PERSONNEL_SAFE_FIELDS = [
  "id",
  "firstName",
  "lastName",
  "userName",
  "role",
  "shift",
  "orgPosition",
  "isPartTimeDriver",
  "workPlace",
  "personnelType",
  "personnelCode",
  "hasAccount",
  "createdAt",
  "phone1",
  "phone2",
  "internalTel",
  "address",
  "avatarColor",
  "accessRoleId",
] as const;

export type PersonnelSafeField = (typeof PERSONNEL_SAFE_FIELDS)[number];

// شکل select برای Prisma بر اساس لیست مجاز بالا
export const PERSONNEL_SAFE_SELECT = Object.fromEntries(
  PERSONNEL_SAFE_FIELDS.map((f) => [f, true])
) as Record<PersonnelSafeField, true>;

// فیلدهای درخواستی کلاینت را برای موجودیت پرسنل به لیست مجاز محدود می‌کند
export function sanitizeReportFields(entity: string, fields: string[]): string[] {
  if (entity !== "personnel") return fields;
  return fields.filter((f) => (PERSONNEL_SAFE_FIELDS as readonly string[]).includes(f));
}

function buildRelationalFieldOperator(op: string, val: any, val2?: any) {
  if (op === "equals") return val;
  if (op === "notEquals") return { not: val };
  if (op === "contains") return { contains: String(val) };
  if (op === "gt") return { gt: val };
  if (op === "lt") return { lt: val };
  if (op === "between") {
    return { gte: val, lte: val2 };
  }
  return val;
}

// ساخت فیلترهای Prisma به صورت داینامیک و امن
export function buildPrismaWhere(entity: string, filters: ReportFilter[]) {
  const where: Record<string, any> = {};

  for (const f of filters) {
    if (!f.field || !f.operator) continue;

    let val: any = f.value;

    // کست کردن تایپ‌ها بر اساس فیلدها
    if (
      f.field === "id" ||
      f.field === "capacity" ||
      f.field === "terminal" ||
      f.field === "type" ||
      f.field === "status" ||
      f.field === "role" ||
      f.field === "shift" ||
      f.field === "orgPosition" ||
      f.field === "trainId" ||
      f.field === "sourceLineId" ||
      f.field === "destinationLineId" ||
      f.field === "rahbar1Id" ||
      f.field === "rahbar2Id" ||
      f.field === "slotIndex" ||
      f.field === "confirmationStatus"
    ) {
      val = f.value ? Number(f.value) : undefined;
    } else if (f.field === "isDynamic" || f.field === "isDisposed" || f.field === "hasAccount") {
      val = f.value === "true" || f.value === "1";
    } else if (f.field === "createdAt" || f.field === "finishedAt" || f.field === "executionTime") {
      val = f.value ? new Date(f.value) : undefined;
    }

    if (val === undefined) continue;

    // هندل کردن فیلدهای رابطه‌ای به صورت هوشمند
    if (entity === "manovr") {
      if (f.field === "sourceLine") {
        where.sourceLine = { name: buildRelationalFieldOperator(f.operator, val, f.value2) };
        continue;
      }
      if (f.field === "destinationLine") {
        where.destinationLine = { name: buildRelationalFieldOperator(f.operator, val, f.value2) };
        continue;
      }
      if (f.field === "train") {
        where.train = { code: buildRelationalFieldOperator(f.operator, val, f.value2) };
        continue;
      }
      if (f.field === "rahbar1") {
        where.rahbar1 = {
          OR: [
            { firstName: { contains: String(val) } },
            { lastName: { contains: String(val) } }
          ]
        };
        continue;
      }
      if (f.field === "rahbar2") {
        where.rahbar2 = {
          OR: [
            { firstName: { contains: String(val) } },
            { lastName: { contains: String(val) } }
          ]
        };
        continue;
      }
      if (f.field === "creator") {
        where.creator = {
          OR: [
            { firstName: { contains: String(val) } },
            { lastName: { contains: String(val) } }
          ]
        };
        continue;
      }
      if (f.field === "isSolo" || f.field === "crewType") {
        if (f.value === "solo" || f.value === "true" || f.value === "1") {
          where.rahbar2Id = null;
        } else if (f.value === "assisted" || f.value === "false" || f.value === "2") {
          where.rahbar2Id = { not: null };
        }
        continue;
      }
    }

    if (entity === "train") {
      if (f.field === "line") {
        where.line = { name: buildRelationalFieldOperator(f.operator, val, f.value2) };
        continue;
      }
    }

    if (f.field === "shift" && entity === "manovr") {
      where.rahbar1 = {
        ...(where.rahbar1 || {}),
        shift: val
      };
      continue;
    }

    if (f.operator === "equals") {
      where[f.field] = val;
    } else if (f.operator === "notEquals") {
      where[f.field] = { not: val };
    } else if (f.operator === "contains") {
      where[f.field] = { contains: String(val) };
    } else if (f.operator === "gt") {
      where[f.field] = { gt: val };
    } else if (f.operator === "lt") {
      where[f.field] = { lt: val };
    } else if (f.operator === "between") {
      const val2 = f.value2 ? (f.field.includes("Date") || f.field.includes("At") || f.field.includes("Time") ? new Date(f.value2) : Number(f.value2)) : undefined;
      if (val2 !== undefined) {
        where[f.field] = { gte: val, lte: val2 };
      }
    }
  }

  // در دپو قطارها و مانورها باید فیلترهای حذف نرم را اعمال کنیم
  if (entity === "manovr" && !where.status) {
    where.status = { not: 3 }; // مانورهای حذف نشده
  }
  if (entity === "train" && where.isDisposed === undefined) {
    where.isDisposed = false; // قطارهای اسقاط نشده
  }

  return where;
}

// فیلدهای مجاز برای مرتب‌سازی امن در هر مدل
const ALLOWED_SORT_FIELDS: Record<string, string[]> = {
  manovr: [
    "id", "type", "status", "confirmationStatus", "createdAt", "finishedAt",
    "executionTime", "trainId", "sourceLineId", "destinationLineId", "rahbar1Id", "rahbar2Id"
  ],
  train: [
    "id", "code", "type", "isDisposed", "lineId", "slotIndex", "status",
    "hasKafshak", "noAtp", "movadDavvar", "noLicense"
  ],
  line: [
    "id", "name", "tag", "capacity", "terminal", "isDynamic", "isActive",
    "posX", "posY", "rotation", "length", "sortIdx"
  ],
  personnel: [
    "id", "firstName", "lastName", "userName", "role", "shift",
    "orgPosition", "workPlace", "personnelType", "personnelCode", "hasAccount", "createdAt"
  ],
};

// اجرای مستقیم کوئری بدون بررسی مجوزهای نشست (کاربرد در زمان‌بند یا گزارش‌های داخلی)
export async function executeReportQuery(config: ReportConfig) {
  const where = buildPrismaWhere(config.entity, config.filters);

  let orderBy: any = undefined;
  if (config.sortField && config.sortField.trim() !== "") {
    const dir = config.sortDirection === "desc" ? "desc" : "asc";
    const sf = config.sortField.trim();

    if (config.entity === "manovr") {
      if (sf === "sourceLine") {
        orderBy = { sourceLine: { name: dir } };
      } else if (sf === "destinationLine") {
        orderBy = { destinationLine: { name: dir } };
      } else if (sf === "train") {
        orderBy = { train: { code: dir } };
      } else if (sf === "rahbar1") {
        orderBy = { rahbar1: { lastName: dir } };
      } else if (sf === "rahbar2") {
        orderBy = { rahbar2: { lastName: dir } };
      } else if (sf === "creator") {
        orderBy = { creator: { lastName: dir } };
      } else if (ALLOWED_SORT_FIELDS.manovr.includes(sf)) {
        orderBy = { [sf]: dir };
      } else {
        orderBy = { id: dir };
      }
    } else if (config.entity === "train") {
      if (sf === "line") {
        orderBy = { line: { name: dir } };
      } else if (ALLOWED_SORT_FIELDS.train.includes(sf)) {
        orderBy = { [sf]: dir };
      } else {
        orderBy = { code: dir };
      }
    } else if (config.entity === "line") {
      if (ALLOWED_SORT_FIELDS.line.includes(sf)) {
        orderBy = { [sf]: dir };
      } else {
        orderBy = { id: dir };
      }
    } else if (config.entity === "personnel") {
      if (ALLOWED_SORT_FIELDS.personnel.includes(sf)) {
        orderBy = { [sf]: dir };
      } else {
        orderBy = { lastName: dir };
      }
    } else {
      orderBy = { id: dir };
    }
  } else {
    // مرتب‌سازی پیش‌فرض امن
    orderBy = config.entity === "manovr" ? { id: "desc" } : { id: "asc" };
  }


  let records: any[] = [];

  if (config.entity === "manovr") {
    records = await prisma.manovr.findMany({
      where,
      orderBy,
      include: { sourceLine: true, destinationLine: true, train: true, rahbar1: true, rahbar2: true, creator: true },
    });
  } else if (config.entity === "train") {
    records = await prisma.train.findMany({
      where,
      orderBy,
      include: { line: true },
    });
  } else if (config.entity === "line") {
    records = await prisma.line.findMany({
      where,
      orderBy,
    });
  } else if (config.entity === "personnel") {
    records = await prisma.personnel.findMany({
      where,
      orderBy,
      select: {
        ...PERSONNEL_SAFE_SELECT,
        accessRole: true,
      },
    });
  }

  return records;
}
