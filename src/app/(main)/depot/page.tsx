import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { getUserSetting, DEFAULT_DEPOT } from "@/lib/settings";
import { getCachedLookup } from "@/lib/lookups";
import DepotScene from "./DepotScene";

export const dynamic = "force-dynamic";

export default async function DepotPage() {
  const session = await getSession();

  // واکشی موازی اطلاعات پایانه
  const [lines, trains, activeManovrs, rahbaran, terminals, manovrTypeLookup] = await Promise.all([
    prisma.line.findMany({
      orderBy: [{ terminal: "asc" }, { sortIdx: "asc" }],
    }),
    prisma.train.findMany({
      where: { isDisposed: false },
      orderBy: { code: "asc" },
    }),
    prisma.manovr.findMany({
      where: { status: 1 }, // مانورهای در جریان
      select: { id: true, trainId: true, destinationLineId: true },
    }),
    prisma.personnel.findMany({
      where: {
        OR: [
          { orgPosition: 1 },
          { isPartTimeDriver: true },
        ],
      },
      select: { id: true, firstName: true, lastName: true, isPartTimeDriver: true, orgPosition: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.lookupValue.findMany({
      where: {
        type: { key: "terminal" },
        isActive: true,
      },
      orderBy: { sortIdx: "asc" },
    }),
    getCachedLookup("manovr_type"),
  ]);

  // دسترسی‌های کاربر
  const canLayout = session ? await hasPerm(session, "depot.layout") : false;
  const canCreateManovr = session ? await hasPerm(session, "manovr.create") : false;
  const canManageLines = session ? await hasPerm(session, "line.view") : false;
  const canEditKafshak = session ? await hasPerm(session, "train.status.kafshak") : false;
  const canEditAtp = session ? await hasPerm(session, "train.status.atp") : false;
  const canEditRotary = session ? await hasPerm(session, "train.status.rotary") : false;
  const canEditLicense = session ? await hasPerm(session, "train.status.license") : false;

  const isManager = session ? (session.role === 1 || session.role === 2 || session.role === 4) : false;
  const pendingCount = isManager
    ? await prisma.manovr.count({
        where: {
          confirmationStatus: 3,
          status: { not: 3 },
        },
      })
    : 0;

  // ترجیحات کاربر برای نمای پایانه
  const depotPrefs = session
    ? await getUserSetting(session.id, "depot", DEFAULT_DEPOT)
    : DEFAULT_DEPOT;

  return (
    <>
      <PageHeader
        title="نمای تعاملی پایانه دپو"
        breadcrumb={[{ label: "عملیات پایانه" }, { label: "نمای پایانه" }]}
        actions={
          <>
            {isManager && pendingCount > 0 && (
              <Link
                href="/manovrs/approvals"
                className="pill p-warn animate-pulse"
                style={{
                  fontSize: "11px",
                  fontWeight: "bold",
                  textDecoration: "none",
                  backgroundColor: "rgba(216, 132, 42, 0.15)",
                  color: "var(--accent)",
                  border: "1px solid var(--accent)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
              >
                ⚠️ {pendingCount} مانور منتظر تأیید مسئول شیفت است
              </Link>
            )}
            {canLayout && (
              <span className="pill p-warn" style={{ fontSize: "11px", fontWeight: "bold" }}>
                🔧 مود چیدمان خطوط فعال است
              </span>
            )}
          </>
        }
      />
      <div className="content" style={{ padding: 0, height: "calc(100vh - 60px)", position: "relative", overflow: "hidden" }}>
        <DepotScene
          lines={lines}
          initialTrains={trains}
          activeManovrs={activeManovrs}
          rahbaran={rahbaran.map((r) => ({
            id: r.id,
            name: `${r.firstName} ${r.lastName}${r.isPartTimeDriver && r.orgPosition !== 1 ? " (راهبر غیردائم)" : ""}`.trim(),
          }))}
          terminals={terminals as any[]}
          manovrTypes={manovrTypeLookup?.values || []}
          canLayout={canLayout}
          canCreateManovr={canCreateManovr}
          canManageLines={canManageLines}
          canEditKafshak={canEditKafshak}
          canEditAtp={canEditAtp}
          canEditRotary={canEditRotary}
          canEditLicense={canEditLicense}
          prefs={depotPrefs}
        />
      </div>
    </>
  );
}
