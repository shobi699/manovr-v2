import { prisma } from "@/lib/prisma";
import { ORG_POSITIONS } from "@/lib/constants";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { redirect } from "next/navigation";
import Link from "next/link";
import UsersTableClient from "./UsersTableClient";
import { getCachedLookup } from "@/lib/lookups";
import { PERSONNEL_SAFE_SELECT } from "@/lib/report-engine";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getSession();
  if (!session) return null;

  const [currentUser, orgPosLookup, shiftLookup, accessRoles] = await Promise.all([
    prisma.personnel.findUnique({
      where: { id: session.id },
      select: { id: true, orgPosition: true, shift: true, personnelType: true },
    }),
    getCachedLookup("org_position"),
    getCachedLookup("shift"),
    prisma.accessRole.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const orgPositions = orgPosLookup?.values || [];
  const shifts = shiftLookup?.values || [];
  const roles = accessRoles.map((r) => ({ code: r.id, label: r.name }));

  const isShiftSupervisor = currentUser?.orgPosition === ORG_POSITIONS.RESPONSIBLE;
  const canViewAll = await hasPerm(session, "user.view");
  const canCreate = await hasPerm(session, "user.create");
  const canEdit = await hasPerm(session, "user.edit");
  const canDelete = await hasPerm(session, "user.delete");

  if (!canViewAll && !isShiftSupervisor) {
    redirect("/depot");
  }

  // اگر مسئول شیفت باشد، فقط پرسنل شیفت و نوع خودش را می‌بیند. در غیر این صورت همه را می‌بیند.
  const baseWhereClause = isShiftSupervisor && currentUser
    ? {
        shift: currentUser.shift ?? undefined,
        personnelType: currentUser.personnelType ?? undefined,
      }
    : {};

  const people = await prisma.personnel.findMany({
    where: baseWhereClause,
    orderBy: [
      { hasAccount: "desc" },
      { orgPosition: "asc" },
      { lastName: "asc" },
      { firstName: "asc" },
    ],
    select: {
      ...PERSONNEL_SAFE_SELECT,
      accessRole: true,
    },
  });

  const totalCount = people.length;
  const accounts = people.filter((p) => p.hasAccount);
  const nonAccounts = people.filter((p) => !p.hasAccount);
  const accountCount = accounts.length;
  const rahbarCount = people.filter((p) => p.orgPosition === 1).length;
  const supervisorCount = people.filter((p) => p.orgPosition === 2).length;
  const technicianCount = people.filter((p) => p.orgPosition === 4).length;

  // لود مانورهای امروز پرسنل شیفت برای مسئول شیفت
  let todayManeuvers: any[] = [];
  if (isShiftSupervisor && currentUser) {
    const allShiftPeople = await prisma.personnel.findMany({
      where: baseWhereClause,
      select: { id: true },
    });
    const subordinateIds = allShiftPeople.map((p) => p.id);
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
    ? `مدیریت و عملکرد شیفت ${shiftNames[currentUser.shift as keyof typeof shiftNames]} (${personnelTypeNames[currentUser.personnelType as keyof typeof personnelTypeNames]})`
    : "مدیریت کاربران و پرسنل";

  const _canCreate = canCreate || isShiftSupervisor;
  const _canEdit = canEdit || isShiftSupervisor;
  const _canDelete = canDelete || isShiftSupervisor;

  return (
    <>
      <div className="topbar">
        <h1>{pageTitle}</h1>
        <span className="spacer" />
        {_canCreate && (
          <Link href="/users/new" className="btn accent sm">
            + افزودن کاربر
          </Link>
        )}
      </div>
      <div className="content">
        {isShiftSupervisor && currentUser ? (
          <div className="tiles">
            <div className="tile"><div className="n">{totalCount}</div><div className="l">پرسنل شیفت</div></div>
            <div className="tile"><div className="n good">{accountCount}</div><div className="l">حساب فعال</div></div>
            <div className="tile"><div className="n info">{todayManeuvers.length}</div><div className="l">مانورهای امروز شیفت</div></div>
          </div>
        ) : (
          <div className="tiles">
            <div className="tile"><div className="n">{totalCount}</div><div className="l">کل پرسنل</div></div>
            <div className="tile"><div className="n good">{accountCount}</div><div className="l">حساب فعال</div></div>
            <div className="tile"><div className="n">{rahbarCount}</div><div className="l">راهبر</div></div>
            <div className="tile"><div className="n">{supervisorCount}</div><div className="l">مسئول شیفت</div></div>
            <div className="tile"><div className="n">{technicianCount}</div><div className="l">تکنیسین</div></div>
          </div>
        )}

        <UsersTableClient
          accounts={accounts}
          nonAccounts={nonAccounts}
          canCreate={_canCreate}
          canEdit={_canEdit}
          canDelete={_canDelete}
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
