import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { prisma } from "@/lib/prisma";
import { resolveBackupPath } from "@/lib/backup";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return new NextResponse("دسترسی غیرمجاز", { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get("id") || "");
    const fileType = searchParams.get("type"); // "db" | "app"

    if (isNaN(id) || !fileType || (fileType !== "db" && fileType !== "app")) {
      return new NextResponse("پارامترهای نامعتبر", { status: 400 });
    }

    // کنترل دقیق سطح دسترسی متناسب با نوع فایل درخواستی
    if (fileType === "app") {
      // دانلود سورس‌کد منحصراً برای سوپرادمین مجاز است
      if (session.role !== 4) {
        return new NextResponse("دسترسی غیرمجاز. فقط سوپرادمین به سورس‌کد دسترسی دارد.", { status: 403 });
      }
    } else {
      // دانلود دیتابیس برای ادمین، سوپرادمین و سرپرستان دارای دسترسی تنظیمات مجاز است
      const isAuthorized = session.role === 1 || session.role === 4 || await hasPerm(session, "backup.manage");
      if (!isAuthorized) {
        return new NextResponse("دسترسی غیرمجاز", { status: 403 });
      }
    }

    const backup = await prisma.backup.findUnique({ where: { id } });
    if (!backup) {
      return new NextResponse("پشتیبان یافت نشد", { status: 404 });
    }

    // کنترل مضاعف بر اساس نوع پشتیبان ثبت‌شده در دیتابیس
    if (backup.backupType === "source_code" && session.role !== 4) {
      return new NextResponse("دسترسی غیرمجاز", { status: 403 });
    }

    let filePaths;
    try {
      filePaths = JSON.parse(backup.filePath);
    } catch {
      filePaths = { db: "", app: "" };
    }

    const rawTargetPath = fileType === "db" ? filePaths.db : filePaths.app;
    const targetPath = resolveBackupPath(rawTargetPath, fileType);

    if (!targetPath || !fs.existsSync(targetPath)) {
      return new NextResponse("فایل روی سرور وجود ندارد یا حذف شده است", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(targetPath);
    const filename = path.basename(targetPath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": fileType === "db" ? "application/octet-stream" : "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (err: any) {
    console.error(err);
    return new NextResponse(err.message || "خطای سرور", { status: 500 });
  }
}
