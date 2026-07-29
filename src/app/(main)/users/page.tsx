import { prisma } from "@/lib/prisma";
import { ORG_POSITIONS } from "@/lib/constants";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { redirect } from "next/navigation";
import Link from "next/link";
import UsersTableClient from "./UsersTableClient";
import { getCachedLookup } from "@/lib/lookups";
import { PERSONNEL_SAFE_SELECT } from "@/lib/report-engine";
import { parseListParams, toPrismaPage } from "@/lib/list-query";

export const dynamic = "force-dynamic";

const ALLOWED_SORT = [
  "firstName",
  "lastName",
  "role",
  "shift",
  "orgPosition",
  "personnelCode",
  "hasAccount",
  "createdAt",
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const resolvedParams = (await searchParams) || {};
  const params = parseListParams(resolvedParams, ALLOWED_SORT);
  const { skip, take } = toPrismaPage(params);

  const [currentUser, orgPosLookup, shiftLookup, roleLookup] = await Promise.all([
    prisma.personnel.findUnique({
      where: { id: session.id },
      select: { id: true, orgPosition: true, shift: true, personnelType: true },
    }),
    getCachedLookup("org_position"),
    getCachedLookup("shift"),
    getCachedLookup("role"),
  ]);

  const orgPositions = orgPosLookup?.values || [];
  const shifts = shiftLookup?.values || [];
  const roles = roleLookup?.values || [];

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

  const whereClause: any = { ...baseWhereClause };

  // فیلترهای صریح از query string
  const roleFilter = typeof resolvedParams.roleFilter === "string" ? resolvedParams.roleFilter.trim() : "";
  const shiftFilter = typeof resolvedParams.shiftFilter === "string" ? resolvedParams.shiftFilter.trim() : "";
  const posFilter = typeof resolvedParams.posFilter === "string" ? resolvedParams.posFilter.trim() : "";

  const andConditions: any[] = [];
  if (roleFilter !== "") andConditions.push({ role: Number(roleFilter) });
  if (shiftFilter !== "") andConditions.push({ shift: Number(shiftFilter) });
  if (posFilter !== "") andConditions.push({ orgPosition: Number(posFilter) });

  if (params.search) {
    andConditions.push({
      OR: [
        { firstName: { contains: params.search } },
        { lastName: { contains: params.search } },
        { personnelCode: { contains: params.search } },
      ],
    });
  }

  if (andConditions.length > 0) {
    whereClause.AND = andConditions;
  }

  const orderBy = params.sortField
    ? [{ [params.sortField]: params.sortDir }]
    : [{ hasAccount: "desc" as const }, { role: "asc" as const }, { firstName: "asc" as const }];

  const [
    people,
    totalRows,
    totalCount,
    accountCount,
    rahbarCount,
    supervisorCount,
    technicianCount,
  ] = await Promise.all([
    prisma.personnel.findMany({
      where: whereClause,
      orderBy,
      skip,
      take,
      select: {
        ...PERSONNEL_SAFE_SELECT,
        accessRole: true,
      },
    }),
    prisma.personnel.count({ where: whereClause }),
    prisma.personnel.count({ where: baseWhereClause }),
    prisma.personnel.count({ where: { ...baseWhereClause, hasAccount: true } }),
    prisma.personnel.count({ where: { ...baseWhereClause, orgPosition: 1 } }),
    prisma.personnel.count({ where: { ...baseWhereClause, orgPosition: 2 } }),
    prisma.personnel.count({ where: { ...baseWhereClause, orgPosition: 4 } }),
  ]);

  const accounts = people.filter((p) => p.hasAccount);
  const nonAccounts = people.filter((p) => !p.hasAccount);

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
          totalRows={totalRows}
          params={params}
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
