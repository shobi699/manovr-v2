import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { getCachedLookup } from "@/lib/lookups";
import { isAdmin } from "@/lib/enums";
import ApprovalsPanelClient from "./ApprovalsPanelClient";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const canConfirm = await hasPerm(session, "manovr.confirm");
  if (!canConfirm) {
    return (
      <div className="content" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div className="card" style={{ padding: "40px", textAlign: "center", maxWidth: "450px" }}>
          <span style={{ fontSize: "48px" }}>⚠️</span>
          <h2 style={{ marginTop: "16px", color: "var(--crit)" }}>عدم دسترسی کافی</h2>
          <p className="muted" style={{ marginTop: "8px" }}>
            شما مجوز لازم برای تأیید یا بستن مانورها را ندارید. این بخش مخصوص مسئولین شیفت و مدیران پایانه می‌باشد.
          </p>
        </div>
      </div>
    );
  }

  const isManager = isAdmin(session.role);

  // لود مانورها و لوکاپ‌های مورد نیاز
  const [manovrs, manovrTypeLookup, manovrStatusLookup, confirmationStatusLookup] = await Promise.all([
    prisma.manovr.findMany({
      where: {
        status: { not: 3 }, // حذف نشده‌ها
      },
      orderBy: { executionTime: "desc" },
      include: {
        sourceLine: true,
        destinationLine: true,
        train: true,
        rahbar1: true,
        rahbar2: true,
        creator: true,
      },
    }),
    getCachedLookup("manovr_type"),
    getCachedLookup("manovr_status"),
    getCachedLookup("confirmation_status"),
  ]);

  return (
    <>
      <PageHeader
        title="تأیید و کنترل مانورها"
        breadcrumb={[{ label: "عملیات پایانه" }, { label: "تأیید و کنترل مانورها" }]}
      />
      <div className="content">
        <ApprovalsPanelClient
          initialManovrs={manovrs}
          manovrTypes={manovrTypeLookup?.values || []}
          manovrStatuses={manovrStatusLookup?.values || []}
          confirmationStatuses={confirmationStatusLookup?.values || []}
          isAdmin={isManager}
        />
      </div>
    </>
  );
}

