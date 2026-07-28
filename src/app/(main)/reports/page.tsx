import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { getSavedReportsAction } from "@/app/actions/report";
import { getScheduledReports } from "@/app/actions/scheduled-report";
import { prisma } from "@/lib/prisma";
import ReportBuilderClient from "./ReportBuilderClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await getSession();
  const canImport = session ? await hasPerm(session, "report.import") : false;

  const [savedReports, scheduledReports] = await Promise.all([
    getSavedReportsAction(),
    getScheduledReports(),
  ]);

  // دریافت پرسنل، خطوط و قطارها برای فیلترهای پیشنهادی
  const [lines, trains, personnel] = await Promise.all([
    prisma.line.findMany({ select: { id: true, name: true } }),
    prisma.train.findMany({ select: { id: true, code: true } }),
    prisma.personnel.findMany({ select: { id: true, firstName: true, lastName: true } }),
  ]);

  return (
    <>
      <div className="topbar">
        <h1>گزارش‌ساز پویا و تحلیلگر داده‌ها</h1>
      </div>
      <div className="content">
        <ReportBuilderClient
          userId={session?.id || 0}
          initialSavedReports={savedReports.map((r) => ({
            id: r.id,
            name: r.name,
            config: r.config,
            isShared: r.isShared,
            ownerName: `${r.owner.firstName} ${r.owner.lastName}`,
            isOwner: r.ownerId === session?.id,
          }))}
          initialScheduledReports={scheduledReports}
          lines={lines}
          trains={trains}
          personnel={personnel.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))}
          canImport={canImport}
        />
      </div>
    </>
  );
}
