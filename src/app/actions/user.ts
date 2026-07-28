"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm, isRoleAllowedToManage, invalidatePermsCache } from "@/lib/perms";
import bcrypt from "bcryptjs";

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
  const isShiftSupervisor = currentUser?.orgPosition === 2;

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
    // سرپرست شیفت فقط می‌تواند در شیفت و نوع پرسنلی خودش کاربر ثبت کند
    shift = currentUser.shift;
    personnelType = currentUser.personnelType;
    if (orgPosition === 2 || orgPosition === 3) {
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

  await prisma.personnel.create({
    data: {
      firstName,
      lastName,
      userName: hasAccount ? userName : null,
      passwordHash,
      role: isShiftSupervisor ? 0 : role, // سرپرست شیفت دسترسی سیستمی ادمین/مسئول نمی‌تواند بدهد
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
  const isShiftSupervisor = currentUser?.orgPosition === 2;

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

  // بررسی سلسله‌مراتب نقش‌ها: مدیر نمی‌تواند هم‌تراز یا لول بالاتر از خود را تغییر دهد
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
    // حفظ شیفت و نوع پرسنلی فعلی
    shift = currentUser.shift;
    personnelType = currentUser.personnelType;
    if (orgPosition === 2 || orgPosition === 3) {
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

  await prisma.personnel.update({
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
  const isShiftSupervisor = currentUser?.orgPosition === 2;

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

  return { ok: true };
}

export async function deleteUser(id: number) {
  const session = await getSession();
  if (!session) return { error: "دسترسی ندارید." };

  const currentUser = await prisma.personnel.findUnique({
    where: { id: session.id },
  });
  const hasManagePerm = await hasPerm(session, "user.manage");
  const isShiftSupervisor = currentUser?.orgPosition === 2;

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
    if (targetUser.orgPosition === 2 || targetUser.orgPosition === 3) {
      return { error: "شما مجاز به حذف مسئولین یا ادمین‌ها نیستید." };
    }
  }

  const manovrCount = await prisma.manovr.count({
    where: { OR: [{ rahbar1Id: id }, { rahbar2Id: id }, { creatorId: id }] },
  });
  if (manovrCount > 0)
    return { error: "این کاربر در مانورها ثبت شده و قابل حذف نیست. حساب را غیرفعال کنید." };

  await prisma.personnel.delete({ where: { id } });
  invalidatePermsCache();
  revalidatePath("/users");
  revalidatePath("/phonebook");
  return {};
}

// ویرایش مخاطب در صفحه دفترچه تلفن
export async function updatePersonnelPhoneInfo(
  _prev: { error?: string; ok?: boolean } | null,
  fd: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "phonebook.edit"))) {
    return { error: "دسترسی ندارید. شما مجاز به ویرایش دفتر تلفن نیستید." };
  }
  const id = Number(fd.get("id"));
  const phone1 = String(fd.get("phone1") ?? "").trim() || null;
  const phone2 = String(fd.get("phone2") ?? "").trim() || null;
  const internalTel = String(fd.get("internalTel") ?? "").trim() || null;
  const address = String(fd.get("address") ?? "").trim() || null;
  const avatarColor = String(fd.get("avatarColor") ?? "").trim() || null;

  await prisma.personnel.update({
    where: { id },
    data: { phone1, phone2, internalTel, address, avatarColor },
  });

  revalidatePath("/phonebook");
  revalidatePath("/users");
  return { ok: true };
}

// ایمپورت گروهی پرسنل از فایل اکسل
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
  const isShiftSupervisor = session ? (await prisma.personnel.findUnique({ where: { id: session.id } }))?.orgPosition === 2 : false;
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

    // بررسی سلسله‌مراتب نقش در ایمپورت گروهی
    const rowRole = row.orgPosition === 3 ? 1 : row.orgPosition === 2 ? 2 : 3;
    if (!isRoleAllowedToManage(session.role, rowRole)) {
      row.orgPosition = 4; // سقوط به نقش و سمت بدون دسترسی سیستمی (سایر)
    }

    const userName = row.userName ? String(row.userName).trim() : null;

    if (userName) {
      const dup = await prisma.personnel.findFirst({ where: { userName } });
      if (dup) continue; // از کاربران تکراری گذر کن
    }

    const personnelCode = row.personnelCode ? String(row.personnelCode).trim() : null;
    if (personnelCode) {
      const dupCode = await prisma.personnel.findFirst({ where: { personnelCode } });
      if (dupCode) continue; // از کدهای تکراری گذر کن
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
    await prisma.personnel.updateMany({
      where: { id: { in: ids } },
      data: { shift },
    });

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
    await prisma.personnel.updateMany({
      where: { id: { in: ids } },
      data: { orgPosition },
    });

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
    // جلوگیری از حذف اکانت جاری ادمین
    const filteredIds = ids.filter((id) => id !== session.id);
    if (filteredIds.length === 0) {
      return { error: "امکان حذف حساب کاربری خودتان وجود ندارد." };
    }

    await prisma.personnel.deleteMany({
      where: { id: { in: filteredIds } },
    });

    revalidatePath("/users");
    revalidatePath("/phonebook");
    return { ok: true, count: filteredIds.length };
  } catch (err: any) {
    return { error: err.message };
  }
}
