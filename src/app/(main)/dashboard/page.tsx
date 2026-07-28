import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getDashboardLayout } from "@/app/actions/dashboard";
import { getCachedLookup } from "@/lib/lookups";
import { Terminal } from "@/lib/enums";
import DashboardLiveRefresh from "./DashboardLiveRefresh";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isManager = session.role === 1 || session.role === 2 || session.role === 4;

  // ۱. واکشی اطلاعات اولیه
  const [
    lines,
    trains,
    activeManovrs,
    personnelCount,
    manovrCount,
    pendingCount,
    recentManovrs,
    manovrTypeLookup,
    terminalLookup,
    layoutConfig,
    personnelList,
  ] = await Promise.all([
    prisma.line.findMany({ orderBy: [{ terminal: "asc" }, { id: "asc" }] }),
    prisma.train.findMany({ where: { isDisposed: false } }),
    prisma.manovr.count({ where: { status: 1 } }),
    prisma.personnel.count(),
    prisma.manovr.count(),
    isManager
      ? prisma.manovr.count({
          where: {
            confirmationStatus: 3,
            status: { not: 3 },
          },
        })
      : Promise.resolve(0),
    prisma.manovr.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        sourceLine: true,
        destinationLine: true,
        train: true,
        rahbar1: true,
      },
    }),
    getCachedLookup("manovr_type"),
    getCachedLookup("terminal"),
    getDashboardLayout(),
    prisma.personnel.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  // ۲. محاسبه خطوط اشغال شده
  const trainByLine = new Map<number, string[]>();
  for (const t of trains) {
    if (t.lineId) {
      const arr = trainByLine.get(t.lineId) ?? [];
      arr.push(t.code);
      trainByLine.set(t.lineId, arr);
    }
  }
  const occupiedLines = [...trainByLine.keys()].length;

  // ۳. گروه‌بندی ترمینال‌ها
  const byTerminal = new Map<number, typeof lines>();
  for (const l of lines) {
    const arr = byTerminal.get(l.terminal) ?? [];
    arr.push(l);
    byTerminal.set(l.terminal, arr);
  }

  const terminalGroups = [...byTerminal.entries()].map(([term, ls]) => ({
    termName: terminalLookup?.values?.find((v) => v.code === term)?.label ?? Terminal[term] ?? `ترمینال ${term}`,
    lines: ls.map((l) => ({
      id: l.id,
      name: l.name,
      capacity: l.capacity,
      trains: trainByLine.get(l.id) ?? [],
    })),
  }));

  // ۴. توزیع فراوانی انواع مانورها
  const manovrsGrouped = await prisma.manovr.groupBy({
    by: ["type"],
    _count: { id: true },
    where: { status: { not: 3 } },
  });

  const typeDistribution = manovrsGrouped.map((g) => {
    const label = manovrTypeLookup?.values?.find((v) => v.code === g.type)?.label || `مانور نوع ${g.type}`;
    return { name: label, value: g._count.id };
  });

  // ۵. روند اجرای مانورها در ۱۰ روز گذشته
  const trendData: { date: string; count: number }[] = [];
  const now = new Date();
  
  for (let i = 9; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);

    const count = await prisma.manovr.count({
      where: {
        createdAt: { gte: d, lte: end },
        status: { not: 3 },
      },
    });

    const jalaliStr = d.toLocaleDateString("fa-IR", {
      calendar: "persian",
      month: "numeric",
      day: "numeric",
    });
    trendData.push({ date: jalaliStr, count });
  }

  return (
    <>
      <DashboardLiveRefresh />
      <DashboardClient
        initialLayout={layoutConfig}
        pendingCount={pendingCount}
        isManager={isManager}
        kpiData={{
          totalLines: lines.length,
          occupiedLines,
          activeTrains: trains.length,
          activeManovrs,
          totalPersonnel: personnelCount,
          totalManovrs: manovrCount,
        }}
        terminalGroups={terminalGroups}
        recentManovrs={recentManovrs}
        typeDistribution={typeDistribution}
        trendData={trendData}
        personnelList={personnelList}
        currentUser={{ id: session.id, fullName: session.fullName, role: session.role }}
      />
    </>
  );
}
