import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import Link from "next/link";
import UsersTableClient from "./UsersTableClient";

import { getCachedLookup } from "@/lib/lookups";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getSession();
  if (!session) return null;

  const [currentUser, orgPosLookup, shiftLookup, roleLookup] = await Promise.all([
    prisma.personnel.findUnique({
      where: { id: session.id },
    }),
    getCachedLookup("org_position"),
    getCachedLookup("shift"),
    getCachedLookup("role"),
  ]);

  const orgPositions = orgPosLookup?.values || [];
  const shifts = shiftLookup?.values || [];
  const roles = roleLookup?.values || [];

  const isShiftSupervisor = currentUser?.orgPosition === 2;
  const canManageAll = await hasPerm(session, "user.manage");

  // اگر مسئول شیفت باشد، فقط پرسنل شیفت و نوع خودش را می‌بیند. در غیر این صورت همه را می‌بیند.
  const supervisor = currentUser as unknown as { shift: number; personnelType: number };
  const whereClause = isShiftSupervisor && currentUser
    ? {
        shift: supervisor.shift,
        personnelType: supervisor.personnelType,
      }
    : {};

  const people = await prisma.personnel.findMany({
    where: whereClause,
    orderBy: [{ hasAccount: "desc" }, { role: "asc" }, { firstName: "asc" }],
    include: { accessRole: true },
  });

  const accounts = people.filter((p) => p.hasAccount);
  const nonAccounts = people.filter((p) => !p.hasAccount);

  // لود مانورهای امروز پرسنل شیفت برای مسئول شیفت
  let todayManeuvers: any[] = [];
  if (isShiftSupervisor && currentUser) {
    const subordinateIds = people.map((p) => p.id);
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const yyyymmdd = formatter.format(new Date());
    const startOfToday = new Date(`${yyyymmdd}T00:00:00.000+03:30`);
    const endOfToday = new Date(`${yyyymmdd}T23:59:59.999+03:30`);

    todayManeuvers = await prisma.manovr.findMany({
      where: {
        createdAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
        OR: [
          { rahbar1Id: { in: subordinateIds } },
          { rahbar2Id: { in: subordinateIds } },
          { creatorId: { in: subordinateIds } },
        ],
      },
      include: {
        rahbar1: true,
        rahbar2: true,
        train: true,
        sourceLine: true,
        destinationLine: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  const shiftNames = { 1: "A", 2: "B", 3: "C" };
  const personnelTypeNames = { 1: "مانور", 2: "پایانه" };

  const pageTitle = isShiftSupervisor && currentUser
    ? `مدیریت و عملکرد شیفت ${shiftNames[supervisor.shift as keyof typeof shiftNames]} (${personnelTypeNames[supervisor.personnelType as keyof typeof personnelTypeNames]})`
    : "مدیریت کاربران و پرسنل";

  const canManage = canManageAll || isShiftSupervisor;

  return (
    <>
      <div className="topbar">
        <h1>{pageTitle}</h1>
        <span className="spacer" />
        {canManage && (
          <Link href="/users/new" className="btn accent sm">
            + افزودن کاربر
          </Link>
        )}
      </div>
      <div className="content">
        {isShiftSupervisor && currentUser ? (
          <div className="tiles">
            <div className="tile"><div className="n">{people.length}</div><div className="l">پرسنل شیفت</div></div>
            <div className="tile"><div className="n good">{accounts.length}</div><div className="l">حساب فعال</div></div>
            <div className="tile"><div className="n info">{todayManeuvers.length}</div><div className="l">مانورهای امروز شیفت</div></div>
          </div>
        ) : (
          <div className="tiles">
            <div className="tile"><div className="n">{people.length}</div><div className="l">کل پرسنل</div></div>
            <div className="tile"><div className="n good">{accounts.length}</div><div className="l">حساب فعال</div></div>
            <div className="tile"><div className="n">{people.filter(p=>p.orgPosition===1).length}</div><div className="l">راهبر</div></div>
            <div className="tile"><div className="n">{people.filter(p=>p.orgPosition===2).length}</div><div className="l">مسئول شیفت</div></div>
            <div className="tile"><div className="n">{people.filter(p=>p.orgPosition===4).length}</div><div className="l">تکنیسین</div></div>
          </div>
        )}

        <UsersTableClient
          accounts={accounts}
          nonAccounts={nonAccounts}
          canManage={canManage}
          currentUserId={session.id}
          isShiftSupervisor={isShiftSupervisor}
          todayManeuvers={todayManeuvers}
          orgPositions={orgPositions}
          shifts={shifts}
          roles={roles}
        />
      </div>
    </>
  );
}
