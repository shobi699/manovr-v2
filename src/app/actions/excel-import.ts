"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm, isRoleAllowedToManage, invalidatePermsCache, mapAccessRoleToLegacyRole } from "@/lib/perms";
import { ORG_POSITIONS } from "@/lib/constants";
import bcrypt from "bcryptjs";
import { audit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type {
  ImportPersonnelRow,
  ExistingPersonnelSummary,
  ImportConflictItem,
  PreValidationResult,
  BatchImportPayload,
  ImportSummaryReport,
} from "@/lib/excel-import-types";

/**
 * تبدیل ارقام فارسی و عربی به ارقام انگلیسی
 */
function normalizeDigits(str?: string | null): string {
  if (!str) return "";
  return String(str)
    .trim()
    .replace(/[۰-۹]/g, (d) => "0123456789"["۰۱۲۳۴۵۶۷۸۹".indexOf(d)])
    .replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]);
}

/**
 * پیش‌اعتبارسنجی داده‌های اکسل و شناسایی تعارضات (تکراری‌ها) قبل از ثبت در پایگاه‌داده
 * از یک کوئری بهینه‌شده به دیتابیس برای جلوگیری از مشکل N+1 استفاده می‌کند.
 */
export async function preValidatePersonnelImport(
  rows: ImportPersonnelRow[]
): Promise<PreValidationResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "دسترسی ندارید. لطفاً وارد سامانه شوید.", totalRows: 0, nonConflicting: [], conflicts: [] };
  }

  const currentUser = await prisma.personnel.findUnique({ where: { id: session.id } });
  const isShiftSupervisor = currentUser?.orgPosition === ORG_POSITIONS.RESPONSIBLE;

  const canImport =
    (await hasPerm(session, "report.import")) ||
    (await hasPerm(session, "user.create")) ||
    (await hasPerm(session, "phonebook.edit")) ||
    isShiftSupervisor;

  if (!canImport) {
    return { ok: false, error: "شما مجوز درون‌ریزی اطلاعات پرسنل را ندارید.", totalRows: 0, nonConflicting: [], conflicts: [] };
  }

  // ۱. فیلتر سطرهای نامعتبر و نرمال‌سازی فیلدها
  const validRows: ImportPersonnelRow[] = [];
  const userNames = new Set<string>();
  const personnelCodes = new Set<string>();
  const phones = new Set<string>();

  for (const r of rows) {
    const firstName = String(r.firstName || "").trim();
    const lastName = String(r.lastName || "").trim();
    if (!firstName || !lastName) continue;

    const normUserName = r.userName ? String(r.userName).trim().toLowerCase() : null;
    const normPersonnelCode = normalizeDigits(r.personnelCode) || null;
    const normPhone1 = normalizeDigits(r.phone1) || null;
    const normPhone2 = normalizeDigits(r.phone2) || null;
    const normInternal = normalizeDigits(r.internalTel) || null;
    const normAddress = r.address ? String(r.address).trim() : null;

    const row: ImportPersonnelRow = {
      rowIndex: r.rowIndex,
      firstName,
      lastName,
      userName: normUserName,
      personnelCode: normPersonnelCode,
      phone1: normPhone1,
      phone2: normPhone2,
      internalTel: normInternal,
      address: normAddress,
      shift: r.shift ? Number(r.shift) : null,
      orgPosition: r.orgPosition ? Number(r.orgPosition) : null,
    };

    validRows.push(row);

    if (row.userName) userNames.add(row.userName);
    if (row.personnelCode) personnelCodes.add(row.personnelCode);
    if (row.phone1) phones.add(row.phone1);
    if (row.phone2) phones.add(row.phone2);
  }

  if (validRows.length === 0) {
    return { ok: false, error: "هیچ سطر معتبری با نام و نام خانوادگی در فایل اکسل یافت نشد.", totalRows: 0, nonConflicting: [], conflicts: [] };
  }

  // ۲. اجرای تک‌کوئری بهینه به دیتابیس برای بازیابی تمام کاندیداهای موجود
  const orConditions: any[] = [];
  if (userNames.size > 0) {
    orConditions.push({ userName: { in: Array.from(userNames) } });
  }
  if (personnelCodes.size > 0) {
    orConditions.push({ personnelCode: { in: Array.from(personnelCodes) } });
  }
  if (phones.size > 0) {
    orConditions.push({ phone1: { in: Array.from(phones) } });
    orConditions.push({ phone2: { in: Array.from(phones) } });
  }

  let candidates: ExistingPersonnelSummary[] = [];
  if (orConditions.length > 0) {
    candidates = await prisma.personnel.findMany({
      where: { OR: orConditions },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        personnelCode: true,
        userName: true,
        phone1: true,
        phone2: true,
        internalTel: true,
        address: true,
        shift: true,
        orgPosition: true,
        hasAccount: true,
        role: true,
        accessRoleId: true,
      },
    });
  }

  // ۳. ایندکس‌گذاری درون‌حافظه‌ای جهت تطابق سریع O(1)
  const byUserName = new Map<string, ExistingPersonnelSummary>();
  const byPersonnelCode = new Map<string, ExistingPersonnelSummary>();
  const byPhone = new Map<string, ExistingPersonnelSummary>();

  for (const cand of candidates) {
    if (cand.userName) byUserName.set(cand.userName.toLowerCase(), cand);
    if (cand.personnelCode) byPersonnelCode.set(cand.personnelCode, cand);
    if (cand.phone1) byPhone.set(cand.phone1, cand);
    if (cand.phone2) byPhone.set(cand.phone2, cand);
  }

  const nonConflicting: ImportPersonnelRow[] = [];
  const conflicts: ImportConflictItem[] = [];

  // ردگیری تکرارهای درون خود فایل اکسل
  const seenUserNames = new Set<string>();
  const seenPersonnelCodes = new Set<string>();

  for (const row of validRows) {
    let matchedExisting: ExistingPersonnelSummary | undefined;
    let matchType: ImportConflictItem["matchType"] = "personnelCode";
    let matchFieldLabel = "";
    let matchValue = "";
    let conflictReason = "";

    // الف) بررسی تکرار کد پرسنلی
    if (row.personnelCode && byPersonnelCode.has(row.personnelCode)) {
      matchedExisting = byPersonnelCode.get(row.personnelCode);
      matchType = "personnelCode";
      matchFieldLabel = "کد پرسنلی";
      matchValue = row.personnelCode;
      conflictReason = `کد پرسنلی «${row.personnelCode}» قبلاً برای پرسنل «${matchedExisting?.firstName} ${matchedExisting?.lastName}» در پایگاه‌داده ثبت شده است.`;
    }
    // ب) بررسی تکرار نام کاربری
    else if (row.userName && byUserName.has(row.userName)) {
      matchedExisting = byUserName.get(row.userName);
      matchType = "userName";
      matchFieldLabel = "نام کاربری";
      matchValue = row.userName;
      conflictReason = `نام کاربری «${row.userName}» قبلاً برای پرسنل «${matchedExisting?.firstName} ${matchedExisting?.lastName}» ثبت شده است.`;
    }
    // ج) بررسی تکرار شماره همراه ۱
    else if (row.phone1 && byPhone.has(row.phone1)) {
      matchedExisting = byPhone.get(row.phone1);
      matchType = "phone";
      matchFieldLabel = "شماره همراه";
      matchValue = row.phone1;
      conflictReason = `شماره تلفن «${row.phone1}» با اطلاعات پرسنل «${matchedExisting?.firstName} ${matchedExisting?.lastName}» هم‌پوشانی دارد.`;
    }
    // د) بررسی تکرار شماره همراه ۲
    else if (row.phone2 && byPhone.has(row.phone2)) {
      matchedExisting = byPhone.get(row.phone2);
      matchType = "phone";
      matchFieldLabel = "شماره همراه ۲";
      matchValue = row.phone2;
      conflictReason = `شماره تلفن دوم «${row.phone2}» با اطلاعات پرسنل «${matchedExisting?.firstName} ${matchedExisting?.lastName}» هم‌پوشانی دارد.`;
    }

    if (matchedExisting) {
      conflicts.push({
        id: `conflict_${row.rowIndex}_${matchedExisting.id}`,
        rowIndex: row.rowIndex,
        matchType,
        matchFieldLabel,
        matchValue,
        conflictReason,
        existingRecord: matchedExisting,
        newRecord: row,
        action: "update", // پیش‌فرض: به‌روزرسانی با داده‌های جدید
      });
    } else {
      // بررسی تکرار درون خود فایل اکسل
      if (row.personnelCode && seenPersonnelCodes.has(row.personnelCode)) {
        // سطر تکراری درون خود اکسل
        continue;
      }
      if (row.userName && seenUserNames.has(row.userName)) {
        continue;
      }

      if (row.personnelCode) seenPersonnelCodes.add(row.personnelCode);
      if (row.userName) seenUserNames.add(row.userName);

      nonConflicting.push(row);
    }
  }

  return {
    ok: true,
    totalRows: validRows.length,
    nonConflicting,
    conflicts,
  };
}

/**
 * اجرای دسته‌ای و تراکنشی اتمیک درون‌ریزی اکسل با اعمال مصوبات کاربر (Update / Skip / Create)
 */
export async function executePersonnelImportBatch(
  payload: BatchImportPayload
): Promise<ImportSummaryReport> {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      error: "دسترسی ندارید.",
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      totalProcessed: 0,
      message: "خطا در احراز هویت.",
    };
  }

  const currentUser = await prisma.personnel.findUnique({ where: { id: session.id } });
  const isShiftSupervisor = currentUser?.orgPosition === ORG_POSITIONS.RESPONSIBLE;

  const canImport =
    (await hasPerm(session, "report.import")) ||
    (await hasPerm(session, "user.create")) ||
    (await hasPerm(session, "phonebook.edit")) ||
    isShiftSupervisor;

  if (!canImport) {
    return {
      ok: false,
      error: "شما مجوز درون‌ریزی اطلاعات پرسنل را ندارید.",
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      totalProcessed: 0,
      message: "عدم دسترسی.",
    };
  }

  try {
    // نقش پیش‌فرض سیستمی V3 برای حساب‌های کاربری جدید
    const defaultAccessRole =
      (await prisma.accessRole.findFirst({ where: { name: "مشاهده" } })) ||
      (await prisma.accessRole.findFirst({ orderBy: { id: "asc" } }));

    const defaultRoleId = defaultAccessRole ? defaultAccessRole.id : null;
    const defaultLegacyRole = defaultAccessRole ? mapAccessRoleToLegacyRole(defaultAccessRole.name) : 3;

    // تولید هش رمز عبور پیش‌فرض خارج از تراکنش جهت رفع فشار CPU و پیشگیری از قفل تراکنش
    const anyHasAccount = payload.newRecords.some((r) => Boolean(r.userName));
    const defaultPasswordHash = anyHasAccount ? await bcrypt.hash("123456", 10) : null;

    // اجرای اتمیک درون تراکنش با مهلت زمانی ۶۰ ثانیه (جهت جلوگیری از انقضای تایم‌اوت ۵ ثانیه‌ای)
    const result = await prisma.$transaction(
      async (tx) => {
        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        // ۱. درج رکوردهای جدید و بدون تعارض
        for (const row of payload.newRecords) {
          const hasAccount = Boolean(row.userName);
          const passwordHash = hasAccount ? defaultPasswordHash : null;
          const rowRole = row.orgPosition === ORG_POSITIONS.ADMIN ? 1 : row.orgPosition === ORG_POSITIONS.RESPONSIBLE ? 2 : defaultLegacyRole;

          const role = hasAccount ? (isRoleAllowedToManage(session.role, rowRole) ? rowRole : defaultLegacyRole) : 0;
          const accessRoleId = hasAccount ? (isShiftSupervisor ? null : defaultRoleId) : null;

          await tx.personnel.create({
            data: {
              firstName: row.firstName.trim(),
              lastName: row.lastName.trim(),
              userName: row.userName || null,
              personnelCode: row.personnelCode || null,
              phone1: row.phone1 || null,
              phone2: row.phone2 || null,
              internalTel: row.internalTel || null,
              address: row.address || null,
              shift: row.shift ?? 1,
              orgPosition: row.orgPosition ?? 4,
              hasAccount,
              passwordHash,
              role,
              accessRoleId,
              personnelType: 1,
              avatarColor: "hsla(" + Math.floor(Math.random() * 360) + ", 70%, 45%, 0.85)",
            },
          });
          createdCount++;
        }

        // ۲. پردازش تعارض‌ها بر اساس انتخاب کاربر (Update یا Skip)
        for (const res of payload.resolutions) {
        if (res.action === "skip") {
          skippedCount++;
          continue;
        }

        if (res.action === "update") {
          const updateData: any = {
            firstName: res.data.firstName.trim(),
            lastName: res.data.lastName.trim(),
          };

          if (res.data.personnelCode) updateData.personnelCode = res.data.personnelCode;
          if (res.data.userName) updateData.userName = res.data.userName;
          if (res.data.phone1) updateData.phone1 = res.data.phone1;
          if (res.data.phone2) updateData.phone2 = res.data.phone2;
          if (res.data.internalTel) updateData.internalTel = res.data.internalTel;
          if (res.data.address) updateData.address = res.data.address;
          if (res.data.shift) updateData.shift = res.data.shift;
          if (res.data.orgPosition) updateData.orgPosition = res.data.orgPosition;

          await tx.personnel.update({
            where: { id: res.existingId },
            data: updateData,
          });
          updatedCount++;
        }
      }

      // ۳. ثبت رویداد در لاگ وقایع سیستم
      if (createdCount > 0 || updatedCount > 0) {
        await audit(
          session,
          "personnel",
          0,
          "CREATE",
          null,
          { createdCount, updatedCount, skippedCount },
          `درون‌ریزی هوشمند اکسل: ${createdCount} رکورد جدید درج شد، ${updatedCount} رکورد به‌روزرسانی شد، و ${skippedCount} مورد صرف‌نظر گردید.`
        );
      }

      return {
        createdCount,
        updatedCount,
        skippedCount,
        totalProcessed: createdCount + updatedCount + skippedCount,
      };
    }, {
      maxWait: 15000,
      timeout: 60000,
    });

    invalidatePermsCache();
    revalidatePath("/users");
    revalidatePath("/phonebook");

    return {
      ok: true,
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      skippedCount: result.skippedCount,
      totalProcessed: result.totalProcessed,
      message: `عملیات درون‌ریزی با موفقیت پایان یافت: ${result.createdCount} پرسنل جدید اضافه شد، ${result.updatedCount} رکورد به‌روزرسانی شد و از ${result.skippedCount} مورد تکراری صرف‌نظر گردید.`,
    };
  } catch (err: any) {
    console.error("[executePersonnelImportBatch error]:", err);
    return {
      ok: false,
      error: `خطا در پردازش تراکنشی اکسل: ${err?.message || "خطای نامشخص"}`,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      totalProcessed: 0,
      message: "تراکنش به طور کامل بازگردانی (Rollback) شد.",
    };
  }
}
