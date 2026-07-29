import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { runDynamicReport } from "@/app/actions/report";
import { generatePDFBuffer, MAX_EXPORT_RECORDS } from "@/lib/export-helpers";
import { getCachedLookup } from "@/lib/lookups";
import { sanitizeReportFields } from "@/lib/report-engine";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "report.export"))) {
    return new NextResponse("عدم دسترسی", { status: 403 });
  }

  const config = await req.json();
  const [res, manovrTypeL, trainTypeL, terminalL, shiftL, orgPosL, roleL] = await Promise.all([
    runDynamicReport(config),
    getCachedLookup("manovr_type"),
    getCachedLookup("train_type"),
    getCachedLookup("terminal"),
    getCachedLookup("shift"),
    getCachedLookup("org_position"),
    getCachedLookup("role"),
  ]);

  if (res.error || !res.records) {
    return new NextResponse(res.error || "خطا در دریافت داده‌ها", { status: 400 });
  }

  if (res.records.length > MAX_EXPORT_RECORDS) {
    return new NextResponse(`تعداد رکوردهای درخواستی (${res.records.length}) از سقف مجاز خروجی (${MAX_EXPORT_RECORDS}) بیشتر است. لطفاً فیلترهای محدودکننده‌تری اعمال نمایید.`, { status: 400 });
  }

  const lookupsMap = {
    manovr_type: manovrTypeL?.values || [],
    train_type: trainTypeL?.values || [],
    terminal: terminalL?.values || [],
    shift: shiftL?.values || [],
    org_position: orgPosL?.values || [],
    role: roleL?.values || [],
  };

  const buffer = await generatePDFBuffer(config.entity, sanitizeReportFields(config.entity, config.fields), res.records, lookupsMap);

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="depot-report-${config.entity}.pdf"`,
    },
  });
}
