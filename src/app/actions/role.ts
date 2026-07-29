"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm, invalidatePermsCache } from "@/lib/perms";
import { audit } from "@/lib/audit";
import {
  roleCreatedSummary,
  roleUpdatedSummary,
  roleDeletedSummary,
} from "@/lib/audit-summaries";

export async function createRole(
  _prev: { error?: string } | null,
  fd: FormData
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "role.manage"))) {
    return { error: "دسترسی ندارید. فقط مدیران اجازه تغییر نقش‌ها را دارند." };
  }

  const name = String(fd.get("name") ?? "").trim();
  const permsRaw = fd.getAll("permissions"); // دریافت آرایه دسترسی‌ها از فرم

  if (!name) return { error: "نام نقش الزامی است." };

  const exists = await prisma.accessRole.findUnique({ where: { name } });
  if (exists) return { error: "نقشی با این نام وجود دارد." };

  const created = await prisma.accessRole.create({
    data: {
      name,
      permissions: JSON.stringify(permsRaw),
      isSystem: false,
    },
  });

  await audit(
    session,
    "accessRole",
    created.id,
    "CREATE",
    null,
    created,
    roleCreatedSummary(created.name, permsRaw.length)
  );

  invalidatePermsCache();
  revalidatePath("/roles");
  revalidatePath("/users");
  redirect("/roles");
}

export async function updateRole(
  _prev: { error?: string } | null,
  fd: FormData
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "role.manage"))) {
    return { error: "دسترسی ندارید." };
  }

  const id = Number(fd.get("id"));
  const name = String(fd.get("name") ?? "").trim();
  const permsRaw = fd.getAll("permissions");

  if (!name) return { error: "نام نقش الزامی است." };

  const role = await prisma.accessRole.findUnique({ where: { id } });
  if (!role) return { error: "نقش یافت نشد." };

  let updateData: any = {
    permissions: JSON.stringify(permsRaw),
  };

  if (!role.isSystem) {
    if (!name) return { error: "نام نقش الزامی است." };
    const dup = await prisma.accessRole.findFirst({ where: { name, NOT: { id } } });
    if (dup) return { error: "نقشی با این نام وجود دارد." };
    updateData.name = name;
  }

  const updated = await prisma.accessRole.update({
    where: { id },
    data: updateData,
  });

  await audit(
    session,
    "accessRole",
    id,
    "UPDATE",
    role,
    updated,
    roleUpdatedSummary(updated.name, permsRaw.length)
  );

  invalidatePermsCache();
  revalidatePath("/roles");
  revalidatePath("/users");
  redirect("/roles");
}

export async function deleteRole(id: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "role.manage"))) {
    return { error: "دسترسی ندارید." };
  }

  const role = await prisma.accessRole.findUnique({ where: { id } });
  if (!role) return { error: "نقش یافت نشد." };
  if (role.isSystem) return { error: "نقش‌های سیستمی قابل حذف نیستند." };

  const userCount = await prisma.personnel.count({ where: { accessRoleId: id } });
  if (userCount > 0) {
    return { error: "این نقش به برخی کاربران اختصاص داده شده و قابل حذف نیست." };
  }

  await prisma.accessRole.delete({ where: { id } });

  await audit(
    session,
    "accessRole",
    id,
    "DELETE",
    role,
    null,
    roleDeletedSummary(role.name)
  );

  invalidatePermsCache();
  revalidatePath("/roles");
  revalidatePath("/users");
  return { ok: true };
}
