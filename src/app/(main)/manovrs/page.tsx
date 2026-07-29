import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { getCachedLookup } from "@/lib/lookups";
import { parseListParams, toPrismaPage } from "@/lib/list-query";
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
    andConditions.push({ train: { code: { contains: trainCode } } });
  }
  if (typeFilter !== "") {
    andConditions.push({ type: Number(typeFilter) });
  }
  if (srcLine) {
    andConditions.push({ sourceLine: { name: { contains: srcLine } } });
  }
  if (destLine) {
    andConditions.push({ destinationLine: { name: { contains: destLine } } });
  }
  if (statusFilter !== "") {
    andConditions.push({ status: Number(statusFilter) });
  }
  if (confFilter !== "") {
    andConditions.push({ confirmationStatus: Number(confFilter) });
  }
  if (rahbarFilter) {
    andConditions.push({
      OR: [
        { rahbar1: { firstName: { contains: rahbarFilter } } },
        { rahbar1: { lastName: { contains: rahbarFilter } } },
      ],
    });
  }
  if (creatorFilter) {
    andConditions.push({
      OR: [
        { creator: { firstName: { contains: creatorFilter } } },
        { creator: { lastName: { contains: creatorFilter } } },
      ],
    });
  }

  if (params.search) {
    andConditions.push({
      OR: [
        { train: { code: { contains: params.search } } },
        { description: { contains: params.search } }
      ],
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const orderBy = params.sortField
    ? { [params.sortField]: params.sortDir }
    : { createdAt: "desc" as const };

  const [manovrs, totalRows, manovrTypeLookup, manovrStatusLookup, confirmationStatusLookup] =
    await Promise.all([
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
          creator: true,
        },
      }),
      prisma.manovr.count({ where }),
      getCachedLookup("manovr_type"),
      getCachedLookup("manovr_status"),
      getCachedLookup("confirmation_status"),
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
        />
      </div>
    </>
  );
}
