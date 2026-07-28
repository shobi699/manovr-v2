"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { audit } from "@/lib/audit";

export async function createTrain(
  _prev: { error?: string } | null,
  fd: FormData
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "train.manage")))
    return { error: "دسترسی ندارید. فقط ادمین اجازه افزودن قطار را دارد." };

  const code = String(fd.get("code") ?? "").trim();
  const type = Number(fd.get("type"));
  const lineId = fd.get("lineId") ? Number(fd.get("lineId")) : null;
  const slotIndex = fd.get("slotIndex") ? Number(fd.get("slotIndex")) : 0;
  const hasKafshak = fd.get("hasKafshak") === "1";
  const noAtp = fd.get("noAtp") === "1";
  const movadDavvarRaw = String(fd.get("movadDavvar") ?? "").trim();
  const movadDavvar = ["A", "B", "C"].includes(movadDavvarRaw) ? movadDavvarRaw : null;
  const noLicense = fd.get("noLicense") === "1";

  if (!code) return { error: "کد قطار الزامی است." };
  if (isNaN(type)) return { error: "نوع قطار را انتخاب کنید." };

  const exists = await prisma.train.findFirst({ where: { code } });
  if (exists) return { error: "قطاری با این کد وجود دارد." };

  const created = await prisma.train.create({
    data: { code, type, lineId, slotIndex, isDisposed: false, hasKafshak, noAtp, movadDavvar, noLicense },
  });

  await audit(
    session,
    "train",
    created.id,
    "CREATE",
    null,
    created,
    `قطار جدید با پلاک ${code} در سیستم ثبت گردید.`
  );

  revalidatePath("/trains");
  revalidatePath("/dashboard");
  revalidatePath("/depot");
  redirect("/trains");
}

export async function updateTrain(
  _prev: { error?: string } | null,
  fd: FormData
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "train.manage")))
    return { error: "دسترسی ندارید. فقط ادمین اجازه ویرایش قطار را دارد." };

  const id = Number(fd.get("id"));
  const code = String(fd.get("code") ?? "").trim();
  const type = Number(fd.get("type"));
  const lineId = fd.get("lineId") ? Number(fd.get("lineId")) : null;
  const slotIndex = fd.get("slotIndex") ? Number(fd.get("slotIndex")) : undefined;
  const isDisposed = fd.get("isDisposed") === "1";
  const hasKafshak = fd.get("hasKafshak") === "1";
  const noAtp = fd.get("noAtp") === "1";
  const movadDavvarRaw = String(fd.get("movadDavvar") ?? "").trim();
  const movadDavvar = ["A", "B", "C"].includes(movadDavvarRaw) ? movadDavvarRaw : null;
  const noLicense = fd.get("noLicense") === "1";

  if (!code) return { error: "کد قطار الزامی است." };

  const dup = await prisma.train.findFirst({ where: { code, NOT: { id } } });
  if (dup) return { error: "قطاری با این کد وجود دارد." };

  const before = await prisma.train.findUnique({ where: { id } });
  const after = await prisma.train.update({
    where: { id },
    data: { code, type, lineId, slotIndex, isDisposed, hasKafshak, noAtp, movadDavvar, noLicense },
  });

  await audit(
    session,
    "train",
    id,
    "UPDATE",
    before,
    after,
    `مشخصات قطار پلاک ${code} به‌روزرسانی گردید.`
  );

  revalidatePath("/trains");
  revalidatePath("/dashboard");
  revalidatePath("/depot");
  redirect("/trains");
}

export async function deleteTrain(id: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "train.manage"))) return { error: "دسترسی ندارید." };

  const before = await prisma.train.findUnique({ where: { id } });
  const hasManovr = await prisma.manovr.count({ where: { trainId: id } });
  
  if (hasManovr > 0) {
    const after = await prisma.train.update({ where: { id }, data: { isDisposed: true } });
    await audit(
      session,
      "train",
      id,
      "DELETE",
      before,
      after,
      `قطار پلاک ${before?.code} به دلیل داشتن تاریخچه مانور به صورت نرم غیرفعال (Disposed) شد.`
    );
  } else {
    await prisma.train.delete({ where: { id } });
    await audit(
      session,
      "train",
      id,
      "DELETE",
      before,
      null,
      `قطار پلاک ${before?.code} با موفقیت از سیستم حذف گردید.`
    );
  }

  revalidatePath("/trains");
  revalidatePath("/dashboard");
  revalidatePath("/depot");
  return {};
}

export async function relocateTrainDirectly(
  trainId: number,
  lineId: number | null,
  slotIndex: number
) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "train.manage"))) {
    return { error: "دسترسی ندارید." };
  }

  try {
    const before = await prisma.train.findUnique({ where: { id: trainId } });
    const after = await prisma.train.update({
      where: { id: trainId },
      data: { lineId, slotIndex },
    });

    await audit(
      session,
      "train",
      trainId,
      "UPDATE",
      before,
      after,
      `قطار پلاک ${before?.code} مستقیماً روی نقشه دپو جابجا شد.`
    );

    revalidatePath("/depot");
    revalidatePath("/trains");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function updateTrainStatus(trainId: number, status: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "train.manage"))) {
    return { error: "دسترسی ندارید. فقط ادمین اجازه تغییر وضعیت قطار را دارد." };
  }

  try {
    const before = await prisma.train.findUnique({ where: { id: trainId } });
    const after = await prisma.train.update({
      where: { id: trainId },
      data: { status },
    });

    await audit(
      session,
      "train",
      trainId,
      "UPDATE",
      before,
      after,
      `وضعیت فنی قطار پلاک ${before?.code} تغییر یافت.`
    );

    revalidatePath("/depot");
    revalidatePath("/trains");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function importTrainsFromExcel(list: {
  code: string;
  type?: number;
  status?: number;
  lineName?: string;
  slotIndex?: number;
}[]): Promise<{ error?: string; count?: number }> {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "train.manage"))) {
    return { error: "دسترسی ندارید. فقط ادمین اجازه بارگذاری قطار را دارد." };
  }

  let count = 0;
  for (const row of list) {
    const code = String(row.code).trim();
    if (!code) continue;

    const dup = await prisma.train.findFirst({ where: { code } });
    if (dup) continue;

    let lineId = null;
    if (row.lineName) {
      const line = await prisma.line.findFirst({ where: { name: row.lineName.trim() } });
      if (line) lineId = line.id;
    }

    await prisma.train.create({
      data: {
        code,
        type: row.type ?? 0,
        status: row.status ?? 1,
        lineId,
        slotIndex: row.slotIndex ?? 0,
        isDisposed: false,
      },
    });
    count++;
  }

  revalidatePath("/trains");
  revalidatePath("/dashboard");
  revalidatePath("/depot");
  return { count };
}

export async function updateTrainFlags(
  trainId: number,
  flags: {
    hasKafshak?: boolean;
    noAtp?: boolean;
    movadDavvar?: string | null;
    noLicense?: boolean;
  }
) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "train.manage"))) {
    return { error: "دسترسی ندارید. فقط ادمین اجازه تغییر وضعیت قطار را دارد." };
  }

  try {
    const before = await prisma.train.findUnique({ where: { id: trainId } });
    const after = await prisma.train.update({
      where: { id: trainId },
      data: flags,
    });

    await audit(
      session,
      "train",
      trainId,
      "UPDATE",
      before,
      after,
      `تغییر وضعیت فنی قطار ${before?.code} (کفشک/ATP/دوّار/مجوز)`
    );

    revalidatePath("/depot");
    revalidatePath("/trains");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function bulkUpdateTrainStatus(ids: number[], status: number) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "train.manage"))) {
    return { error: "دسترسی ندارید. فقط ادمین یا مسئول شیفت اجازه تغییر وضعیت دسته‌جمعی قطارها را دارد." };
  }

  try {
    await prisma.train.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });

    await audit(
      session,
      "train",
      0,
      "UPDATE",
      null,
      { ids, status },
      `تغییر وضعیت گروهی ${ids.length} قطار به حالت ${status}`
    );

    revalidatePath("/depot");
    revalidatePath("/trains");
    revalidatePath("/dashboard");
    return { ok: true, count: ids.length };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function bulkUpdateTrainFlags(
  ids: number[],
  flags: {
    hasKafshak?: boolean;
    noAtp?: boolean;
    movadDavvar?: string | null;
    noLicense?: boolean;
  }
) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "train.manage"))) {
    return { error: "دسترسی ندارید. فقط ادمین اجازه تغییر وضعیت فنی دسته‌جمعی را دارد." };
  }

  try {
    await prisma.train.updateMany({
      where: { id: { in: ids } },
      data: flags,
    });

    await audit(
      session,
      "train",
      0,
      "UPDATE",
      null,
      { ids, flags },
      `تغییر گروهی ویژگی‌های فنی ${ids.length} قطار`
    );

    revalidatePath("/depot");
    revalidatePath("/trains");
    revalidatePath("/dashboard");
    return { ok: true, count: ids.length };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function bulkToggleTrainDisposed(ids: number[], isDisposed: boolean) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "train.manage"))) {
    return { error: "دسترسی ندارید. فقط ادمین اجازه تغییر وضعیت سیستم قطارها را دارد." };
  }

  try {
    await prisma.train.updateMany({
      where: { id: { in: ids } },
      data: { isDisposed },
    });

    await audit(
      session,
      "train",
      0,
      "UPDATE",
      null,
      { ids, isDisposed },
      `${isDisposed ? "غیرفعال‌سازی" : "فعال‌سازی"} گروهی ${ids.length} قطار`
    );

    revalidatePath("/depot");
    revalidatePath("/trains");
    revalidatePath("/dashboard");
    return { ok: true, count: ids.length };
  } catch (err: any) {
    return { error: err.message };
  }
}

