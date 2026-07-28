"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";

export async function createLine(
  _prev: { error?: string } | null,
  fd: FormData
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "line.manage")))
    return { error: "دسترسی ندارید. فقط ادمین اجازه افزودن خط را دارد." };

  const name = String(fd.get("name") ?? "").trim();
  const tag = String(fd.get("tag") ?? "").trim() || null;
  const capacity = Number(fd.get("capacity") || 1);
  const terminal = Number(fd.get("terminal"));
  const isDynamic = fd.get("isDynamic") === "1";

  const posX = fd.get("posX") ? Number(fd.get("posX")) : 0;
  const posY = fd.get("posY") ? Number(fd.get("posY")) : 0;
  const rotation = fd.get("rotation") ? Number(fd.get("rotation")) : 0;
  const length = fd.get("length") ? Number(fd.get("length")) : 30;

  if (!name) return { error: "نام خط الزامی است." };
  if (!terminal) return { error: "ترمینال را انتخاب کنید." };
  const termVal = await prisma.lookupValue.findFirst({
    where: {
      type: { key: "terminal" },
      code: terminal,
    },
  });
  if (!termVal) return { error: "ترمینال انتخاب شده نامعتبر است." };
  if (capacity < 1) return { error: "ظرفیت باید حداقل ۱ باشد." };

  await prisma.line.create({
    data: { name, tag, capacity, terminal, isDynamic, posX, posY, rotation, length },
  });

  revalidatePath("/lines");
  revalidatePath("/dashboard");
  revalidatePath("/depot");
  redirect("/lines");
}

export async function updateLine(
  _prev: { error?: string } | null,
  fd: FormData
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "line.manage")))
    return { error: "دسترسی ندارید. فقط ادمین اجازه ویرایش خط را دارد." };

  const id = Number(fd.get("id"));
  const name = String(fd.get("name") ?? "").trim();
  const tag = String(fd.get("tag") ?? "").trim() || null;
  const capacity = Number(fd.get("capacity") || 1);
  const terminal = Number(fd.get("terminal"));
  const isDynamic = fd.get("isDynamic") === "1";

  const posX = fd.get("posX") ? Number(fd.get("posX")) : undefined;
  const posY = fd.get("posY") ? Number(fd.get("posY")) : undefined;
  const rotation = fd.get("rotation") ? Number(fd.get("rotation")) : undefined;
  const length = fd.get("length") ? Number(fd.get("length")) : undefined;

  if (!name) return { error: "نام خط الزامی است." };
  if (!terminal) return { error: "ترمینال را انتخاب کنید." };
  const termVal = await prisma.lookupValue.findFirst({
    where: {
      type: { key: "terminal" },
      code: terminal,
    },
  });
  if (!termVal) return { error: "ترمینال انتخاب شده نامعتبر است." };
  if (capacity < 1) return { error: "ظرفیت باید حداقل ۱ باشد." };

  await prisma.line.update({
    where: { id },
    data: { name, tag, capacity, terminal, isDynamic, posX, posY, rotation, length },
  });

  revalidatePath("/lines");
  revalidatePath("/dashboard");
  revalidatePath("/depot");
  redirect("/lines");
}

export async function deleteLine(id: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "line.manage"))) return { error: "دسترسی ندارید." };

  const trainCount = await prisma.train.count({ where: { lineId: id } });
  if (trainCount > 0) return { error: "این خط دارای قطار است و قابل حذف نیست." };

  const manovrCount = await prisma.manovr.count({
    where: { OR: [{ sourceLineId: id }, { destinationLineId: id }] },
  });
  if (manovrCount > 0) return { error: "این خط در مانورها استفاده شده و قابل حذف نیست." };

  await prisma.line.delete({ where: { id } });
  revalidatePath("/lines");
  revalidatePath("/dashboard");
  revalidatePath("/depot");
  return {};
}

export async function saveLinePositions(positions: { id: number; posX: number; posY: number; rotation: number }[]) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "depot.layout"))) {
    return { error: "دسترسی ندارید. فقط مدیر اجازه تغییر چیدمان پایانه را دارد." };
  }
  for (const pos of positions) {
    await prisma.line.update({
      where: { id: pos.id },
      data: { posX: pos.posX, posY: pos.posY, rotation: pos.rotation },
    });
  }
  revalidatePath("/depot");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function toggleLineActive(id: number, active: boolean) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "line.manage"))) {
    return { error: "دسترسی ندارید. فقط مدیر یا ادمین اجازه فعال/غیرفعال کردن خط را دارد." };
  }
  await (prisma.line as any).update({
    where: { id },
    data: { isActive: active },
  });
  revalidatePath("/depot");
  revalidatePath("/lines");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function importLinesFromExcel(list: {
  name: string;
  tag?: string;
  capacity?: number;
  terminalCode?: number;
  isDynamic?: boolean;
}[]): Promise<{ error?: string; count?: number }> {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "line.manage"))) {
    return { error: "دسترسی ندارید. فقط ادمین اجازه بارگذاری خط را دارد." };
  }

  let count = 0;
  for (const row of list) {
    const name = String(row.name).trim();
    if (!name) continue;

    const dup = await prisma.line.findFirst({ where: { name } });
    if (dup) continue;

    const terminal = row.terminalCode ?? 1;
    const termVal = await prisma.lookupValue.findFirst({
      where: {
        type: { key: "terminal" },
        code: terminal,
      },
    });
    if (!termVal) continue;

    await prisma.line.create({
      data: {
        name,
        tag: row.tag ? String(row.tag).trim() : null,
        capacity: row.capacity ?? 1,
        terminal,
        isDynamic: row.isDynamic ?? false,
      },
    });
    count++;
  }

  revalidatePath("/lines");
  revalidatePath("/dashboard");
  revalidatePath("/depot");
  return { count };
}
