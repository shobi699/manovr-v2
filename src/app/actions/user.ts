"use server";

import { revalidatePath } from "next/cache";
import { ORG_POSITIONS } from "@/lib/constants";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm, isRoleAllowedToManage, invalidatePermsCache, mapAccessRoleToLegacyRole } from "@/lib/perms";
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
import {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  formatZodError,
} from "@/lib/validations";

export async function createUser(
  _prev: { error?: string } | null,
  fd: FormData
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "دسترسی ندارید." };

  const currentUser = await prisma.personnel.findUnique({
    where: { id: session.id },
  });
  const hasManagePerm = await hasPerm(session, "user.create");
  const isShiftSupervisor = currentUser?.orgPosition === ORG_POSITIONS.RESPONSIBLE;

  if (!hasManagePerm && !isShiftSupervisor) {
    return { error: "دسترسی ندارید. شما مجاز به افزودن کاربر نیستید." };
  }

  const rawInput = Object.fromEntries(fd.entries());
  const parsed = createUserSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: formatZodError(parsed.error) };
  }

  const {
    firstName,
    lastName,
    userName,
    password,
    role: initialRole,
    shift: defaultShift,
    orgPosition: defaultOrgPosition,
    isPartTimeDriver: initialIsPartTimeDriver,
    personnelType: defaultPersonnelType,
    personnelCode,
    hasAccount,
    accessRoleId: initialAccessRoleId,
    phone1,
    phone2,
    internalTel,
    address,
    avatarColor,
  } = parsed.data;

  let shift = defaultShift;
  let orgPosition = defaultOrgPosition;
  let isPartTimeDriver = orgPosition === 1 ? false : Boolean(initialIsPartTimeDriver);
  let personnelType = defaultPersonnelType;
  let accessRoleId = initialAccessRoleId;
  let computedRole = initialRole ?? 0;

  if (hasAccount) {
    let targetAccessRole = accessRoleId
      ? await prisma.accessRole.findUnique({ where: { id: accessRoleId } })
      : null;

    // در صورت مشخص نبودن نقش سفارشی، نقش پیش‌فرض مشاهده یا اولین نقش سیستم را انتصاب می‌دهیم
    if (!targetAccessRole) {
      targetAccessRole = await prisma.accessRole.findFirst({
        where: { name: "مشاهده" },
      }) || await prisma.accessRole.findFirst({ orderBy: { id: "asc" } });
      if (targetAccessRole) {
        accessRoleId = targetAccessRole.id;
      }
    }

    computedRole = targetAccessRole
      ? mapAccessRoleToLegacyRole(targetAccessRole.name)
      : (initialRole ?? 3);

    if (!isRoleAllowedToManage(session.role, computedRole)) {
      return { error: "شما مجاز به تعیین این نقش برای کاربر جدید نیستید (هم‌سطح یا بالاتر از شما)." };
    }
  } else {
    accessRoleId = null;
    computedRole = 0;
  }

  if (isShiftSupervisor && currentUser) {
    shift = currentUser.shift;
    personnelType = currentUser.personnelType;
    if (orgPosition === ORG_POSITIONS.RESPONSIBLE || orgPosition === ORG_POSITIONS.ADMIN) {
      return { error: "شما مجاز به تعیین سمت مسئول شیفت یا ادمین نیستید." };
    }
    computedRole = 0;
    accessRoleId = null;
  }

  if (hasAccount && userName) {
    const dup = await prisma.personnel.findFirst({ where: { userName } });
    if (dup) return { error: "این نام کاربری قبلاً ثبت شده." };
  }

  if (personnelCode) {
    const dupCode = await prisma.personnel.findFirst({ where: { personnelCode } });
    if (dupCode) return { error: "این کد پرسنلی قبلاً ثبت شده است." };
  }

  const pwdToHash = password && password.trim().length >= 4 ? password.trim() : "123456";
  const passwordHash = hasAccount
    ? await bcrypt.hash(pwdToHash, 10)
    : null;

  const created = await prisma.personnel.create({
    data: {
      firstName,
      lastName,
      userName: hasAccount ? userName : null,
      passwordHash,
      role: computedRole,
      shift,
      orgPosition,
      isPartTimeDriver,
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
    created.id,
    "CREATE",
    null,
    created,
    personnelCreatedSummary(created)
  );

  invalidatePermsCache();
  revalidatePath("/users");
  revalidatePath("/manovrs/new");
  revalidatePath("/depot");
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
  const hasManagePerm = await hasPerm(session, "user.edit");
  const isShiftSupervisor = currentUser?.orgPosition === ORG_POSITIONS.RESPONSIBLE;

  if (!hasManagePerm && !isShiftSupervisor) {
    return { error: "دسترسی ندارید." };
  }

  const rawInput = Object.fromEntries(fd.entries());
  const parsed = updateUserSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: formatZodError(parsed.error) };
  }

  const {
    id,
    firstName,
    lastName,
    userName,
    role: initialRole,
    shift: initialShift,
    orgPosition: initialOrgPosition,
    isPartTimeDriver: initialIsPartTimeDriver,
    personnelType: initialPersonnelType,
    personnelCode,
    hasAccount,
    accessRoleId: initialAccessRoleId,
    phone1,
    phone2,
    internalTel,
    address,
    avatarColor,
  } = parsed.data;

  let shift = initialShift;
  let orgPosition = initialOrgPosition;
  let isPartTimeDriver = orgPosition === 1 ? false : Boolean(initialIsPartTimeDriver);
  let personnelType = initialPersonnelType;
  let accessRoleId = initialAccessRoleId;

  const targetUser = await prisma.personnel.findUnique({
    where: { id },
    include: { accessRole: true },
  });
  if (!targetUser) return { error: "کاربر مورد نظر یافت نشد." };

  if (id !== session.id && !isRoleAllowedToManage(session.role, targetUser.role)) {
    return { error: "شما مجاز به ویرایش این کاربر نیستید (هم‌سطح یا بالاتر از شما)." };
  }

  let role = targetUser.role;

  if (hasAccount) {
    let targetAccessRole = accessRoleId
      ? await prisma.accessRole.findUnique({ where: { id: accessRoleId } })
      : null;

    if (!targetAccessRole && targetUser.accessRoleId) {
      targetAccessRole = targetUser.accessRole;
      accessRoleId = targetUser.accessRoleId;
    }

    if (!targetAccessRole) {
      targetAccessRole = await prisma.accessRole.findFirst({
        where: { name: "مشاهده" },
      }) || await prisma.accessRole.findFirst({ orderBy: { id: "asc" } });
      if (targetAccessRole) {
        accessRoleId = targetAccessRole.id;
      }
    }

    const computedRole = targetAccessRole
      ? mapAccessRoleToLegacyRole(targetAccessRole.name)
      : (initialRole ?? targetUser.role);

    if (!isRoleAllowedToManage(session.role, computedRole)) {
      return { error: "شما مجاز به تغییر نقش کاربر به سطح برابر یا بالاتر از خود نیستید." };
    }

    if (id === session.id && accessRoleId !== targetUser.accessRoleId) {
      return { error: "شما مجاز به تغییر نقش کاربری خود نیستید." };
    }

    role = computedRole;
  } else {
    accessRoleId = null;
    role = 0;
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

  const newPassword =
    typeof rawInput.password === "string" && rawInput.password.trim().length >= 4
      ? await bcrypt.hash(rawInput.password.trim(), 10)
      : (!targetUser.passwordHash && hasAccount ? await bcrypt.hash("123456", 10) : undefined);

  const updated = await prisma.personnel.update({
    where: { id },
    data: {
      firstName,
      lastName,
      userName: hasAccount ? userName : null,
      ...(newPassword ? { passwordHash: newPassword } : {}),
      role,
      shift,
      orgPosition,
      isPartTimeDriver,
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
  revalidatePath(`/users/${id}/edit`);
  revalidatePath("/manovrs/new");
  revalidatePath("/depot");
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
  const hasManagePerm = (await hasPerm(session, "user.edit")) || (await hasPerm(session, "user.delete"));
  const isShiftSupervisor = currentUser?.orgPosition === ORG_POSITIONS.RESPONSIBLE;

  if (!hasManagePerm && !isShiftSupervisor) {
    return { error: "دسترسی ندارید." };
  }

  const parsed = resetPasswordSchema.safeParse({
    userId: fd.get("id"),
    password: fd.get("password"),
  });
  if (!parsed.success) {
    return { error: formatZodError(parsed.error) };
  }

  const { userId: id, password } = parsed.data;

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
  const hasManagePerm = await hasPerm(session, "user.edit");
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
    const hasUserManage = await hasPerm(session, "user.edit");
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
    !(await hasPerm(session, "user.create")) &&
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

    const rawUserName = row.userName ? String(row.userName).trim() : "";
    const userName = rawUserName.length > 0 ? rawUserName : null;

    if (userName) {
      const dup = await prisma.personnel.findFirst({ where: { userName } });
      if (dup) continue;
    }

    const personnelCode = row.personnelCode ? String(row.personnelCode).trim() : null;
    if (personnelCode) {
      const dupCode = await prisma.personnel.findFirst({ where: { personnelCode } });
      if (dupCode) continue;
    }

    // اگر سطر اکسل دارای نام کاربری باشد، به صورت خودکار حساب کاربری با رمز ۱۲۳۴۵۶ برای او فعال می‌شود
    const hasAccount = Boolean(userName);
    const passwordHash = hasAccount ? await bcrypt.hash("123456", 10) : null;
    const role = hasAccount ? rowRole : 0;

    await prisma.personnel.create({
      data: {
        firstName: row.firstName.trim(),
        lastName: row.lastName.trim(),
        userName,
        passwordHash,
        role,
        personnelCode,
        phone1: row.phone1 ? String(row.phone1).trim() : null,
        phone2: row.phone2 ? String(row.phone2).trim() : null,
        internalTel: row.internalTel ? String(row.internalTel).trim() : null,
        address: row.address ? String(row.address).trim() : null,
        shift: row.shift ?? 1,
        orgPosition: row.orgPosition ?? 4,
        hasAccount,
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
  if (!session || !(await hasPerm(session, "user.edit"))) {
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
  if (!session || !(await hasPerm(session, "user.edit"))) {
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
  if (!session || !(await hasPerm(session, "user.delete"))) {
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

/**
 * ایجاد گروهی حساب کاربری برای پرسنل انتخاب‌شده با رمز عبور پیش‌فرض ۱۲۳۴۵۶
 */
export async function bulkCreateUserAccounts(ids: number[]): Promise<{
  ok?: boolean;
  error?: string;
  count?: number;
  message?: string;
}> {
  const session = await getSession();
  if (!session) return { error: "ابتدا وارد سامانه شوید." };

  const hasPermManage =
    (await hasPerm(session, "user.create")) || (await hasPerm(session, "user.edit"));
  const currentUser = await prisma.personnel.findUnique({ where: { id: session.id } });
  const isShiftSupervisor = currentUser?.orgPosition === ORG_POSITIONS.RESPONSIBLE;

  if (!hasPermManage && !isShiftSupervisor) {
    return { error: "شما دسترسی لازم برای ایجاد حساب کاربری را ندارید." };
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return { error: "هیچ کاربری انتخاب نشده است." };
  }

  try {
    const defaultPasswordHash = await bcrypt.hash("123456", 10);
    const personnelList = await prisma.personnel.findMany({
      where: { id: { in: ids } },
    });

    let createdCount = 0;

    for (const p of personnelList) {
      // تعیین نام کاربری: اگر پرسنلی کد دارد، از آن استفاده کن، در غیر این صورت نام کاربری فعلی یا user_ID
      let proposedUserName = (p.userName || p.personnelCode || "").trim();
      if (!proposedUserName) {
        proposedUserName = `user_${p.id}`;
      }

      // اطمینان از یکتا بودن نام کاربری
      const dup = await prisma.personnel.findFirst({
        where: {
          userName: proposedUserName,
          NOT: { id: p.id },
        },
      });

      if (dup) {
        proposedUserName = `${proposedUserName}_${p.id}`;
      }

      await prisma.personnel.update({
        where: { id: p.id },
        data: {
          hasAccount: true,
          userName: proposedUserName,
          passwordHash: p.passwordHash || defaultPasswordHash,
          role: p.role === 0 ? 3 : p.role, // اگر نقش ندارد، حداقل دسترسی مشاهده (Viewer = 3)
        },
      });

      createdCount++;
    }

    await audit(
      session,
      "personnel",
      0,
      "UPDATE",
      null,
      { ids, count: createdCount },
      `ساخت دسته‌جمعی حساب کاربری برای ${createdCount} پرسنل با رمز عبور پیش‌فرض ۱۲۳۴۵۶`
    );

    invalidatePermsCache();
    revalidatePath("/users");
    revalidatePath("/phonebook");

    return {
      ok: true,
      count: createdCount,
      message: `برای ${createdCount} پرسنل با موفقیت حساب کاربری با رمز عبور پیش‌فرض ۱۲۳۴۵۶ فعال شد.`,
    };
  } catch (err: any) {
    return { error: err?.message || "خطا در ایجاد گروهی حساب‌های کاربری" };
  }
}

