import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { isAdmin } from "@/lib/enums";
import { getCachedLookup } from "@/lib/lookups";
import { parseListParams, toPrismaPage } from "@/lib/list-query";
import { generateSearchVariants } from "@/lib/persian-text";
import ManovrsTableClient from "./ManovrsTableClient";

export const dynamic = "force-dynamic";

const ALLOWED_SORT = [
  "id",
  "createdAt",
  "executionTime",
  "finishedAt",
  "type",
  "status",
  "confirmationStatus",
];

export default async function ManovrsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  const canWrite = session ? await hasPerm(session, "manovr.create") : false;
  const canEdit = session ? await hasPerm(session, "manovr.edit") : false;
  const canConfirm = session ? await hasPerm(session, "manovr.confirm") : false;
  const canDelete = session ? await hasPerm(session, "manovr.delete") : false;
  const isManager = session ? isAdmin(session.role) : false;


  const resolvedParams = (await searchParams) || {};
  const params = parseListParams(resolvedParams, ALLOWED_SORT);
  const { skip, take } = toPrismaPage(params);

  // استخراج فیلترهای اضافی از query string
  const trainCode = typeof resolvedParams.trainCode === "string" ? resolvedParams.trainCode.trim() : "";
  const typeFilter = typeof resolvedParams.typeFilter === "string" ? resolvedParams.typeFilter.trim() : "";
  const srcLine = typeof resolvedParams.srcLine === "string" ? resolvedParams.srcLine.trim() : "";
  const destLine = typeof resolvedParams.destLine === "string" ? resolvedParams.destLine.trim() : "";
  const statusFilter = typeof resolvedParams.statusFilter === "string" ? resolvedParams.statusFilter.trim() : "";
  const confFilter = typeof resolvedParams.confFilter === "string" ? resolvedParams.confFilter.trim() : "";
  const rahbarFilter = typeof resolvedParams.rahbarFilter === "string" ? resolvedParams.rahbarFilter.trim() : "";
  const creatorFilter = typeof resolvedParams.creatorFilter === "string" ? resolvedParams.creatorFilter.trim() : "";

  const where: any = {};
  const andConditions: any[] = [];

  if (trainCode) {
    const variants = generateSearchVariants(trainCode);
    andConditions.push({ OR: variants.map((v) => ({ train: { code: { contains: v } } })) });
  }
  if (typeFilter !== "") {
    andConditions.push({ type: Number(typeFilter) });
  }
  if (srcLine) {
    const variants = generateSearchVariants(srcLine);
    andConditions.push({ OR: variants.map((v) => ({ sourceLine: { name: { contains: v } } })) });
  }
  if (destLine) {
    const variants = generateSearchVariants(destLine);
    andConditions.push({ OR: variants.map((v) => ({ destinationLine: { name: { contains: v } } })) });
  }
  if (statusFilter !== "") {
    andConditions.push({ status: Number(statusFilter) });
  }
  if (confFilter !== "") {
    andConditions.push({ confirmationStatus: Number(confFilter) });
  }
  if (rahbarFilter) {
    const variants = generateSearchVariants(rahbarFilter);
    andConditions.push({
      OR: variants.flatMap((v) => [
        { rahbar1: { firstName: { contains: v } } },
        { rahbar1: { lastName: { contains: v } } },
      ]),
    });
  }
  if (creatorFilter) {
    const variants = generateSearchVariants(creatorFilter);
    andConditions.push({
      OR: variants.flatMap((v) => [
        { creator: { firstName: { contains: v } } },
        { creator: { lastName: { contains: v } } },
      ]),
    });
  }

  if (params.search) {
    const variants = generateSearchVariants(params.search);
    andConditions.push({
      OR: variants.flatMap((v) => [
        { train: { code: { contains: v } } },
        { description: { contains: v } },
      ]),
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const orderBy = params.sortField
    ? { [params.sortField]: params.sortDir }
    : { createdAt: "desc" as const };

  const [
    manovrs,
    totalRows,
    manovrTypeLookup,
    manovrStatusLookup,
    confirmationStatusLookup,
    shiftLookup,
    drivers,
    trains,
  ] = await Promise.all([
    prisma.manovr.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        sourceLine: true,
        destinationLine: true,
        train: true,
        rahbar1: true,
        rahbar2: true,
        creator: true,
      },
    }),
    prisma.manovr.count({ where }),
    getCachedLookup("manovr_type"),
    getCachedLookup("manovr_status"),
    getCachedLookup("confirmation_status"),
    getCachedLookup("shift"),
    prisma.personnel.findMany({
      where: {
        OR: [
          { orgPosition: 1 },
          { isPartTimeDriver: true },
          { manovrsAsRahbar1: { some: {} } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        personnelCode: true,
        shift: true,
        isPartTimeDriver: true,
        orgPosition: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.train.findMany({
      where: { isDisposed: false },
      select: { id: true, code: true, type: true, status: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="مدیریت و تاریخچه مانورها"
        breadcrumb={[{ label: "عملیات پایانه" }, { label: "تاریخچه مانورها" }]}
        actions={
          canWrite ? (
            <Link href="/manovrs/new" className="btn primary">
              ثبت مانور جدید
            </Link>
          ) : undefined
        }
      />
      <div className="content">
        <ManovrsTableClient
          manovrs={manovrs}
          totalRows={totalRows}
          params={params}
          canEdit={canEdit}
          canConfirm={canConfirm}
          canDelete={canDelete}
          manovrTypes={manovrTypeLookup?.values || []}
          manovrStatuses={manovrStatusLookup?.values || []}
          confirmationStatuses={confirmationStatusLookup?.values || []}
          shifts={shiftLookup?.values || []}
          drivers={drivers}
          trains={trains}
          isAdmin={isManager}
        />
      </div>
    </>
  );
}

