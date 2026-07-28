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
    if (f.field === "id" || f.field === "capacity" || f.field === "terminal" || f.field === "type" || f.field === "status" || f.field === "role" || f.field === "shift" || f.field === "orgPosition" || f.field === "trainId" || f.field === "sourceLineId" || f.field === "destinationLineId" || f.field === "rahbar1Id" || f.field === "confirmationStatus") {
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

// اجرای مستقیم کوئری بدون بررسی مجوزهای نشست (کاربرد در زمان‌بند یا گزارش‌های داخلی)
export async function executeReportQuery(config: ReportConfig) {
  const where = buildPrismaWhere(config.entity, config.filters);

  let orderBy: any = undefined;
  if (config.sortField) {
    const dir = config.sortDirection || "asc";
    const sf = config.sortField;
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
      } else {
        orderBy = { [sf]: dir };
      }
    } else if (config.entity === "train") {
      if (sf === "line") {
        orderBy = { line: { name: dir } };
      } else {
        orderBy = { [sf]: dir };
      }
    } else {
      orderBy = { [sf]: dir };
    }
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
      include: { accessRole: true },
    });
  }

  return records;
}
