"use server";

import { revalidatePath } from "next/cache";
import { ORG_POSITIONS } from "@/lib/constants";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm, isRoleAllowedToManage, invalidatePermsCache } from "@/lib/perms";
import bcrypt from "bcryptjs";
import { audit } from "@/lib/audit";
import {
  personnelCreatedSummary,
  personnelUpdatedSummary,
  personnelDeletedSummary,
  passwordResetSummary,
  bulkPersonnelSummary,
  importSummary,
} from "@/lib/audit-summaries";
import { findUnmanageableIds } from "@/lib/bulk-guards";

export async function createUser(
  _prev: { error?: string } | null,
  fd: FormData
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "دسترسی ندارید." };

  const currentUser = await prisma.personnel.findUnique({
    where: { id: session.id },
  });
  const hasManagePerm = await hasPerm(session, "user.manage");
  const isShiftSupervisor = currentUser?.orgPosition === ORG_POSITIONS.RESPONSIBLE;

  if (!hasManagePerm && !isShiftSupervisor) {
    return { error: "دسترسی ندارید. شما مجاز به افزودن کاربر نیستید." };
  }

  const firstName = String(fd.get("firstName") ?? "").trim();
  const lastName = String(fd.get("lastName") ?? "").trim();
  const userName = String(fd.get("userName") ?? "").trim() || null;
  const password = String(fd.get("password") ?? "").trim();
  const role = Number(fd.get("role") ?? 0);
  let shift = Number(fd.get("shift") ?? 1);
  let orgPosition = Number(fd.get("orgPosition") ?? 4);
  let personnelType = Number(fd.get("personnelType") ?? 1);
  const personnelCode = String(fd.get("personnelCode") ?? "").trim() || null;
  const hasAccount = fd.get("hasAccount") === "1";
  const accessRoleId = fd.get("accessRoleId") ? Number(fd.get("accessRoleId")) : null;

  const phone1 = fd.get("phone1") ? String(fd.get("phone1")).trim() : null;
  const phone2 = fd.get("phone2") ? String(fd.get("phone2")).trim() : null;
  const internalTel = fd.get("internalTel") ? String(fd.get("internalTel")).trim() : null;
  const address = fd.get("address") ? String(fd.get("address")).trim() : null;
  const avatarColor = fd.get("avatarColor") ? String(fd.get("avatarColor")).trim() : null;

  if (!firstName) return { error: "نام الزامی است." };
  if (!lastName) return { error: "نام خانوادگی الزامی است." };

  if (!isRoleAllowedToManage(session.role, role)) {
    return { error: "شما مجاز به تعیین این نقش برای کاربر جدید نیستید (هم‌سطح یا بالاتر از شما)." };
  }

  if (isShiftSupervisor && currentUser) {
    shift = currentUser.shift;
    personnelType = currentUser.personnelType;
    if (orgPosition === ORG_POSITIONS.RESPONSIBLE || orgPosition === ORG_POSITIONS.ADMIN) {
      return { error: "شما مجاز به تعیین سمت مسئول شیفت یا ادمین نیستید." };
    }
  }

  if (hasAccount) {
    if (!userName) return { error: "نام کاربری برای حساب فعال الزامی است." };
    if (!password || password.length < 4)
      return { error: "رمز عبور حداقل ۴ کاراکتر باشد." };

    const dup = await prisma.personnel.findFirst({ where: { userName } });
    if (dup) return { error: "این نام کاربری قبلاً ثبت شده." };
  }

  if (personnelCode) {
    const dupCode = await prisma.personnel.findFirst({ where: { personnelCode } });
    if (dupCode) return { error: "این کد پرسنلی قبلاً ثبت شده است." };
  }

  const passwordHash = hasAccount && password
    ? await bcrypt.hash(password, 10)
    : null;

  const created = await prisma.personnel.create({
    data: {
      firstName,
      lastName,
      userName: hasAccount ? userName : null,
      passwordHash,
      role: isShiftSupervisor ? 0 : role,
      shift,
      orgPosition,
      personnelType,
      personnelCode,
      hasAccount,
      accessRoleId: isShiftSupervisor ? null : accessRoleId,
      phone1,
      phone2,
      internalTel,
      address,
      avatarColor,
    },
  });

  await audit(
    session,
    "personnel",
    created.id,
    "CREATE",
    null,
    created,
    personnelCreatedSummary(created)
  );

  invalidatePermsCache();
  revalidatePath("/users");
  revalidatePath("/phonebook");
  redirect("/users");
}

export async function updateUser(
  _prev: { error?: string } | null,
  fd: FormData
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "دسترسی ندارید." };

  const currentUser = await prisma.personnel.findUnique({
    where: { id: session.id },
  });
  const hasManagePerm = await hasPerm(session, "user.manage");
  const isShiftSupervisor = currentUser?.orgPosition === ORG_POSITIONS.RESPONSIBLE;

  if (!hasManagePerm && !isShiftSupervisor) {
    return { error: "دسترسی ندارید." };
  }

  const id = Number(fd.get("id"));
  const targetUser = await prisma.personnel.findUnique({ where: { id } });
  if (!targetUser) return { error: "کاربر مورد نظر یافت نشد." };

  const firstName = String(fd.get("firstName") ?? "").trim();
  const lastName = String(fd.get("lastName") ?? "").trim();
  const userName = String(fd.get("userName") ?? "").trim() || null;
  let role = Number(fd.get("role") ?? 0);
  let shift = Number(fd.get("shift") ?? 1);
  let orgPosition = Number(fd.get("orgPosition") ?? 4);
  let personnelType = Number(fd.get("personnelType") ?? 1);
  const personnelCode = String(fd.get("personnelCode") ?? "").trim() || null;
  const hasAccount = fd.get("hasAccount") === "1";
  let accessRoleId = fd.get("accessRoleId") ? Number(fd.get("accessRoleId")) : null;

  const phone1 = fd.get("phone1") ? String(fd.get("phone1")).trim() : null;
  const phone2 = fd.get("phone2") ? String(fd.get("phone2")).trim() : null;
  const internalTel = fd.get("internalTel") ? String(fd.get("internalTel")).trim() : null;
  const address = fd.get("address") ? String(fd.get("address")).trim() : null;
  const avatarColor = fd.get("avatarColor") ? String(fd.get("avatarColor")).trim() : null;

  if (!firstName) return { error: "نام الزامی است." };
  if (!lastName) return { error: "نام خانوادگی الزامی است." };

  if (!isRoleAllowedToManage(session.role, targetUser.role)) {
    return { error: "شما مجاز به ویرایش این کاربر نیستید (هم‌سطح یا بالاتر از شما)." };
  }
  if (!isRoleAllowedToManage(session.role, role)) {
    return { error: "شما مجاز به تغییر نقش کاربر به سطح برابر یا بالاتر از خود نیستید." };
  }
  if (id === session.id && role !== targetUser.role) {
    return { error: "شما مجاز به تغییر نقش کاربری خود نیستید." };
  }

  if (isShiftSupervisor && currentUser) {
    if (targetUser.shift !== currentUser.shift || targetUser.personnelType !== currentUser.personnelType) {
      return { error: "شما فقط مجاز به ویرایش پرسنل شیفت خود هستید." };
    }
    shift = currentUser.shift;
    personnelType = currentUser.personnelType;
    if (orgPosition === ORG_POSITIONS.RESPONSIBLE || orgPosition === ORG_POSITIONS.ADMIN) {
      return { error: "شما مجاز به تعیین سمت مسئول شیفت یا ادمین نیستید." };
    }
    role = targetUser.role;
    accessRoleId = targetUser.accessRoleId;
  }

  if (hasAccount && !userName)
    return { error: "نام کاربری برای حساب فعال الزامی است." };

  if (hasAccount && userName) {
    const dup = await prisma.personnel.findFirst({
      where: { userName, NOT: { id } },
    });
    if (dup) return { error: "این نام کاربری قبلاً ثبت شده." };
  }

  if (personnelCode) {
    const dupCode = await prisma.personnel.findFirst({
      where: { personnelCode, NOT: { id } },
    });
    if (dupCode) return { error: "این کد پرسنلی قبلاً برای کاربر دیگری ثبت شده است." };
  }

  const updated = await prisma.personnel.update({
    where: { id },
    data: {
      firstName,
      lastName,
      userName: hasAccount ? userName : null,
      role,
      shift,
      orgPosition,
      personnelType,
      personnelCode,
      hasAccount,
      accessRoleId,
      phone1,
      phone2,
      internalTel,
      address,
      avatarColor,
    },
  });

  await audit(
    session,
    "personnel",
    id,
    "UPDATE",
    targetUser,
    updated,
    personnelUpdatedSummary(updated)
  );

  invalidatePermsCache();
  revalidatePath("/users");
  revalidatePath("/phonebook");
  redirect("/users");
}

export async function resetPassword(
  _prev: { error?: string; ok?: boolean } | null,
  fd: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "دسترسی ندارید." };

  const currentUser = await prisma.personnel.findUnique({
    where: { id: session.id },
  });
  const hasManagePerm = await hasPerm(session, "user.manage");
  const isShiftSupervisor = currentUser?.orgPosition === ORG_POSITIONS.RESPONSIBLE;

  if (!hasManagePerm && !isShiftSupervisor) {
    return { error: "دسترسی ندارید." };
  }

  const id = Number(fd.get("id"));
  const password = String(fd.get("password") ?? "").trim();

  if (!password || password.length < 4)
    return { error: "رمز عبور حداقل ۴ کاراکتر باشد." };

  const targetUser = await prisma.personnel.findUnique({ where: { id } });
  if (!targetUser) return { error: "کاربر مورد نظر یافت نشد." };

  if (!isRoleAllowedToManage(session.role, targetUser.role)) {
    return { error: "شما مجاز به تغییر رمز عبور این کاربر نیستید (هم‌سطح یا بالاتر از شما)." };
  }

  if (isShiftSupervisor && currentUser) {
    if (targetUser.shift !== currentUser.shift || targetUser.personnelType !== currentUser.personnelType) {
      return { error: "شما فقط مجاز به تغییر رمز پرسنل شیفت خود هستید." };
    }
  }

  const hash = await bcrypt.hash(password, 10);
  await prisma.personnel.update({
    where: { id },
    data: { passwordHash: hash },
  });

  await audit(
    session,
    "personnel",
    id,
    "UPDATE",
    null,
    null,
    passwordResetSummary(targetUser)
  );

  return { ok: true };
}

export async function deleteUser(id: number) {
  const session = await getSession();
  if (!session) return { error: "دسترسی ندارید." };

  const currentUser = await prisma.personnel.findUnique({
    where: { id: session.id },
  });
  const hasManagePerm = await hasPerm(session, "user.manage");
  const isShiftSupervisor = currentUser?.orgPosition === ORG_POSITIONS.RESPONSIBLE;

  if (!hasManagePerm && !isShiftSupervisor) return { error: "دسترسی ندارید." };

  if (id === session.id) return { error: "نمی‌توانید خودتان را حذف کنید." };

  const targetUser = await prisma.personnel.findUnique({ where: { id } });
  if (!targetUser) return { error: "کاربر مورد نظر یافت نشد." };

  if (!isRoleAllowedToManage(session.role, targetUser.role)) {
    return { error: "شما مجاز به حذف این کاربر نیستید (هم‌سطح یا بالاتر از شما)." };
  }

  if (isShiftSupervisor && currentUser) {
    if (targetUser.shift !== currentUser.shift || targetUser.personnelType !== currentUser.personnelType) {
      return { error: "شما فقط مجاز به حذف پرسنل شیفت خود هستید." };
    }
    if (targetUser.orgPosition === ORG_POSITIONS.RESPONSIBLE || targetUser.orgPosition === ORG_POSITIONS.ADMIN) {
      return { error: "شما مجاز به حذف مسئولین یا ادمین‌ها نیستید." };
    }
  }

  const manovrCount = await prisma.manovr.count({
    where: { OR: [{ rahbar1Id: id }, { rahbar2Id: id }, { creatorId: id }] },
  });
  if (manovrCount > 0)
    return { error: "این کاربر در مانورها ثبت شده و قابل حذف نیست. حساب را غیرفعال کنید." };

  await prisma.personnel.delete({ where: { id } });

  await audit(
    session,
    "personnel",
    id,
    "DELETE",
    targetUser,
    null,
    personnelDeletedSummary(targetUser)
  );

  invalidatePermsCache();
  revalidatePath("/users");
  revalidatePath("/phonebook");
  return {};
}

export async function createPhonebookContact(
  _prev: { error?: string; ok?: boolean; contact?: any } | null,
  fd: FormData
): Promise<{ error?: string; ok?: boolean; contact?: any }> {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "phonebook.edit"))) {
    return { error: "دسترسی ندارید. شما مجاز به افزودن مخاطب در دفتر تلفن نیستید." };
  }

  const firstName = String(fd.get("firstName") ?? "").trim();
  const lastName = String(fd.get("lastName") ?? "").trim();
  const personnelCode = String(fd.get("personnelCode") ?? "").trim() || null;
  const shift = Number(fd.get("shift") ?? 1);
  const orgPosition = Number(fd.get("orgPosition") ?? 4);
  const phone1 = String(fd.get("phone1") ?? "").trim() || null;
  const phone2 = String(fd.get("phone2") ?? "").trim() || null;
  const internalTel = String(fd.get("internalTel") ?? "").trim() || null;
  const address = String(fd.get("address") ?? "").trim() || null;
  const avatarColor = String(fd.get("avatarColor") ?? "").trim() || "hsla(" + Math.floor(Math.random() * 360) + ", 70%, 45%, 0.85)";

  if (!firstName) return { error: "نام الزامی است." };
  if (!lastName) return { error: "نام خانوادگی الزامی است." };

  if (personnelCode) {
    const dupCode = await prisma.personnel.findFirst({ where: { personnelCode } });
    if (dupCode) return { error: "این کد پرسنلی قبلاً برای فرد دیگری ثبت شده است." };
  }

  const created = await prisma.personnel.create({
    data: {
      firstName,
      lastName,
      personnelCode,
      shift,
      orgPosition,
      phone1,
      phone2,
      internalTel,
      address,
      avatarColor,
      hasAccount: false,
      role: 0,
      personnelType: 1,
    },
  });

  await audit(
    session,
    "personnel",
    created.id,
    "CREATE",
    null,
    created,
    personnelCreatedSummary(created)
  );

  revalidatePath("/phonebook");
  revalidatePath("/users");
  return { ok: true, contact: created };
}

export async function deletePhonebookContact(id: number): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "phonebook.edit"))) {
    return { error: "دسترسی ندارید. شما مجاز به حذف مخاطب نیستید." };
  }

  const target = await prisma.personnel.findUnique({ where: { id } });
  if (!target) return { error: "مخاطب مورد نظر یافت نشد." };

  if (target.hasAccount) {
    const hasUserManage = await hasPerm(session, "user.manage");
    if (!hasUserManage) {
      return { error: "این مخاطب دارای حساب کاربری فعال است. برای حذف آن به دسترسی مدیریت کاربران نیاز دارید." };
    }
  }

  const manovrCount = await prisma.manovr.count({
    where: { OR: [{ rahbar1Id: id }, { rahbar2Id: id }, { creatorId: id }] },
  });
  if (manovrCount > 0) {
    return { error: "این مخاطب در مانورها ثبت شده و امکان حذف آن وجود ندارد." };
  }

  await prisma.personnel.delete({ where: { id } });

  await audit(
    session,
    "personnel",
    id,
    "DELETE",
    target,
    null,
    personnelDeletedSummary(target)
  );

  revalidatePath("/phonebook");
  revalidatePath("/users");
  return { ok: true };
}

export async function updatePersonnelPhoneInfo(
  _prev: { error?: string; ok?: boolean } | null,
  fd: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "phonebook.edit"))) {
    return { error: "دسترسی ندارید. شما مجاز به ویرایش دفتر تلفن نیستید." };
  }
  const id = Number(fd.get("id"));
  const before = await prisma.personnel.findUnique({ where: { id } });
  if (!before) return { error: "مخاطب مورد نظر یافت نشد." };

  const firstName = fd.has("firstName") ? String(fd.get("firstName") ?? "").trim() : before.firstName;
  const lastName = fd.has("lastName") ? String(fd.get("lastName") ?? "").trim() : before.lastName;
  const personnelCode = fd.has("personnelCode") ? (String(fd.get("personnelCode") ?? "").trim() || null) : before.personnelCode;
  const shift = fd.has("shift") ? Number(fd.get("shift")) : before.shift;
  const orgPosition = fd.has("orgPosition") ? Number(fd.get("orgPosition")) : before.orgPosition;

  const phone1 = fd.has("phone1") ? (String(fd.get("phone1") ?? "").trim() || null) : before.phone1;
  const phone2 = fd.has("phone2") ? (String(fd.get("phone2") ?? "").trim() || null) : before.phone2;
  const internalTel = fd.has("internalTel") ? (String(fd.get("internalTel") ?? "").trim() || null) : before.internalTel;
  const address = fd.has("address") ? (String(fd.get("address") ?? "").trim() || null) : before.address;
  const avatarColor = fd.has("avatarColor") ? (String(fd.get("avatarColor") ?? "").trim() || null) : before.avatarColor;

  if (firstName.length === 0 || lastName.length === 0) {
    return { error: "نام و نام خانوادگی الزامی است." };
  }

  if (personnelCode && personnelCode !== before.personnelCode) {
    const dupCode = await prisma.personnel.findFirst({
      where: { personnelCode, NOT: { id } },
    });
    if (dupCode) return { error: "این کد پرسنلی قبلاً برای مخاطب دیگری ثبت شده است." };
  }

  const updated = await prisma.personnel.update({
    where: { id },
    data: {
      firstName,
      lastName,
      personnelCode,
      shift,
      orgPosition,
      phone1,
      phone2,
      internalTel,
      address,
      avatarColor,
    },
  });

  await audit(
    session,
    "personnel",
    id,
    "UPDATE",
    before,
    updated,
    personnelUpdatedSummary(updated)
  );

  revalidatePath("/phonebook");
  revalidatePath("/users");
  return { ok: true };
}

export async function importPersonnelFromExcel(list: {
  firstName: string;
  lastName: string;
  userName?: string;
  personnelCode?: string;
  phone1?: string;
  phone2?: string;
  internalTel?: string;
  address?: string;
  shift?: number;
  orgPosition?: number;
}[]): Promise<{ error?: string; count?: number }> {
  const session = await getSession();
  const isShiftSupervisor = session ? (await prisma.personnel.findUnique({ where: { id: session.id } }))?.orgPosition === ORG_POSITIONS.RESPONSIBLE : false;
  if (!session || (
    !(await hasPerm(session, "report.import")) &&
    !(await hasPerm(session, "phonebook.edit")) &&
    !(await hasPerm(session, "user.manage")) &&
    !isShiftSupervisor
  )) {
    return { error: "دسترسی ندارید." };
  }

  let count = 0;
  for (const row of list) {
    if (!row.firstName || !row.lastName) continue;

    const rowRole = row.orgPosition === ORG_POSITIONS.ADMIN ? 1 : row.orgPosition === ORG_POSITIONS.RESPONSIBLE ? 2 : 3;
    if (!isRoleAllowedToManage(session.role, rowRole)) {
      row.orgPosition = 4;
    }

    const userName = row.userName ? String(row.userName).trim() : null;

    if (userName) {
      const dup = await prisma.personnel.findFirst({ where: { userName } });
      if (dup) continue;
    }

    const personnelCode = row.personnelCode ? String(row.personnelCode).trim() : null;
    if (personnelCode) {
      const dupCode = await prisma.personnel.findFirst({ where: { personnelCode } });
      if (dupCode) continue;
    }

    await prisma.personnel.create({
      data: {
        firstName: row.firstName.trim(),
        lastName: row.lastName.trim(),
        userName,
        personnelCode,
        phone1: row.phone1 ? String(row.phone1).trim() : null,
        phone2: row.phone2 ? String(row.phone2).trim() : null,
        internalTel: row.internalTel ? String(row.internalTel).trim() : null,
        address: row.address ? String(row.address).trim() : null,
        shift: row.shift ?? 1,
        orgPosition: row.orgPosition ?? 4,
        hasAccount: false,
        avatarColor: "hsla(" + Math.floor(Math.random() * 360) + ", 70%, 45%, 0.85)",
      },
    });
    count++;
  }

  if (count > 0) {
    await audit(session, "personnel", 0, "CREATE", null, null, importSummary("پرسنل", count));
  }

  revalidatePath("/users");
  revalidatePath("/phonebook");
  return { count };
}

export async function bulkUpdateUserShift(ids: number[], shift: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "user.manage"))) {
    return { error: "دسترسی ندارید. فقط ادمین اجازه تغییر شیفت کاری دسته‌جمعی پرسنل را دارد." };
  }

  try {
    const targets = await prisma.personnel.findMany({
      where: { id: { in: ids } },
      select: { id: true, role: true },
    });

    const blocked = findUnmanageableIds(session.role, targets);
    if (blocked.length > 0) {
      return {
        error: `شما مجاز به تغییر ${blocked.length} کاربر از موارد انتخاب‌شده نیستید (هم‌سطح یا بالاتر از شما). هیچ تغییری اعمال نشد.`,
      };
    }

    await prisma.personnel.updateMany({
      where: { id: { in: ids } },
      data: { shift },
    });

    await audit(
      session,
      "personnel",
      0,
      "UPDATE",
      null,
      null,
      bulkPersonnelSummary("تغییر شیفت", ids.length, ids)
    );

    revalidatePath("/users");
    revalidatePath("/phonebook");
    return { ok: true, count: ids.length };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function bulkUpdateUserOrgPosition(ids: number[], orgPosition: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "user.manage"))) {
    return { error: "دسترسی ندارید. فقط ادمین اجازه تغییر سمت دسته‌جمعی پرسنل را دارد." };
  }

  try {
    const targets = await prisma.personnel.findMany({
      where: { id: { in: ids } },
      select: { id: true, role: true },
    });

    const blocked = findUnmanageableIds(session.role, targets);
    if (blocked.length > 0) {
      return {
        error: `شما مجاز به تغییر ${blocked.length} کاربر از موارد انتخاب‌شده نیستید (هم‌سطح یا بالاتر از شما). هیچ تغییری اعمال نشد.`,
      };
    }

    await prisma.personnel.updateMany({
      where: { id: { in: ids } },
      data: { orgPosition },
    });

    await audit(
      session,
      "personnel",
      0,
      "UPDATE",
      null,
      null,
      bulkPersonnelSummary("تغییر سمت", ids.length, ids)
    );

    revalidatePath("/users");
    revalidatePath("/phonebook");
    return { ok: true, count: ids.length };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function bulkDeleteUsers(ids: number[]) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "user.manage"))) {
    return { error: "دسترسی ندارید. فقط ادمین اجازه حذف دسته‌جمعی پرسنل را دارد." };
  }

  try {
    const filteredIds = ids.filter((id) => id !== session.id);
    if (filteredIds.length === 0) {
      return { error: "امکان حذف حساب کاربری خودتان وجود ندارد." };
    }

    const targets = await prisma.personnel.findMany({
      where: { id: { in: filteredIds } },
      select: { id: true, role: true },
    });

    const blocked = findUnmanageableIds(session.role, targets);
    if (blocked.length > 0) {
      return {
        error: `شما مجاز به حذف ${blocked.length} کاربر از موارد انتخاب‌شده نیستید (هم‌سطح یا بالاتر از شما). هیچ کاربری حذف نشد.`,
      };
    }

    const referenced = await prisma.manovr.findMany({
      where: {
        OR: [
          { rahbar1Id: { in: filteredIds } },
          { rahbar2Id: { in: filteredIds } },
          { creatorId: { in: filteredIds } },
        ],
      },
      select: { rahbar1Id: true, rahbar2Id: true, creatorId: true },
    });

    if (referenced.length > 0) {
      const referencedIds = new Set<number>();
      for (const m of referenced) {
        for (const v of [m.rahbar1Id, m.rahbar2Id, m.creatorId]) {
          if (v !== null && filteredIds.includes(v)) referencedIds.add(v);
        }
      }
      return {
        error: `${referencedIds.size} کاربر از موارد انتخاب‌شده در مانورها ثبت شده‌اند و قابل حذف نیستند. حساب آنها را غیرفعال کنید. هیچ کاربری حذف نشد.`,
      };
    }

    await prisma.personnel.deleteMany({
      where: { id: { in: filteredIds } },
    });

    await audit(
      session,
      "personnel",
      0,
      "DELETE",
      null,
      null,
      bulkPersonnelSummary("حذف", filteredIds.length, filteredIds)
    );

    revalidatePath("/users");
    revalidatePath("/phonebook");
    return { ok: true, count: filteredIds.length };
  } catch (err: any) {
    return { error: err.message };
  }
}
