import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { getCachedLookup } from "@/lib/lookups";
import { parseListParams, toPrismaPage } from "@/lib/list-query";
import Link from "next/link";
import TrainsTableClient from "./TrainsTableClient";

export const dynamic = "force-dynamic";

const ALLOWED_SORT = ["code", "type", "status", "slotIndex", "isDisposed"];

export default async function TrainsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  const canManage = session ? await hasPerm(session, "train.manage") : false;

  const resolvedParams = (await searchParams) || {};
  const params = parseListParams(resolvedParams, ALLOWED_SORT);
  const { skip, take } = toPrismaPage(params);

  const filterType = typeof resolvedParams.type === "string" ? resolvedParams.type : "all";
  const filterOpStatus = typeof resolvedParams.opStatus === "string" ? resolvedParams.opStatus : "all";
  const filterLine = typeof resolvedParams.line === "string" ? resolvedParams.line : "all";
  const filterSystemStatus = typeof resolvedParams.sysStatus === "string" ? resolvedParams.sysStatus : "all";
  const filterTechnical = typeof resolvedParams.tech === "string" ? resolvedParams.tech : "all";

  const where: any = {};
  const andConditions: any[] = [];

  if (filterType !== "all") {
    andConditions.push({ type: Number(filterType) });
  }
  if (filterOpStatus !== "all") {
    andConditions.push({ status: Number(filterOpStatus) });
  }
  if (filterLine !== "all") {
    andConditions.push({ lineId: Number(filterLine) });
  }
  if (filterSystemStatus !== "all") {
    andConditions.push({ isDisposed: filterSystemStatus === "disposed" });
  }
  if (filterTechnical !== "all") {
    if (filterTechnical === "hasKafshak") andConditions.push({ hasKafshak: true });
    if (filterTechnical === "noAtp") andConditions.push({ noAtp: true });
    if (filterTechnical === "movadDavvar") andConditions.push({ movadDavvar: { not: null } });
    if (filterTechnical === "movadDavvarA") andConditions.push({ movadDavvar: "A" });
    if (filterTechnical === "movadDavvarB") andConditions.push({ movadDavvar: "B" });
    if (filterTechnical === "movadDavvarC") andConditions.push({ movadDavvar: "C" });
    if (filterTechnical === "noLicense") andConditions.push({ noLicense: true });
  }

  if (params.search) {
    andConditions.push({
      OR: [
        { code: { contains: params.search } },
        { lineTag: { contains: params.search } },
      ],
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const orderBy = params.sortField
    ? { [params.sortField]: params.sortDir }
    : { code: "asc" as const };

  const [
    trains,
    totalRows,
    totalCount,
    ac,
    dc,
    diesel,
    disposed,
    allLines,
    trainTypeLookup,
  ] = await Promise.all([
    prisma.train.findMany({
      where,
      orderBy,
      skip,
      take,
      include: { line: true },
    }),
    prisma.train.count({ where }),
    prisma.train.count(),
    prisma.train.count({ where: { type: 0, isDisposed: false } }),
    prisma.train.count({ where: { type: 1, isDisposed: false } }),
    prisma.train.count({ where: { type: 2, isDisposed: false } }),
    prisma.train.count({ where: { isDisposed: true } }),
    prisma.line.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getCachedLookup("train_type"),
  ]);

  const trainTypes = trainTypeLookup?.values || [];

  return (
    <>
      <div className="topbar">
        <h1>مدیریت قطارها</h1>
        <span className="spacer" />
        {canManage && <Link href="/trains/new" className="btn accent sm">+ افزودن قطار</Link>}
      </div>
      <div className="content">
        <div className="tiles">
          <div className="tile"><div className="n">{totalCount}</div><div className="l">کل قطارها</div></div>
          <div className="tile"><div className="n rail">{ac}</div><div className="l">AC</div></div>
          <div className="tile"><div className="n warn">{dc}</div><div className="l">DC</div></div>
          <div className="tile"><div className="n info">{diesel}</div><div className="l">دیزل</div></div>
          <div className="tile"><div className="n">{disposed}</div><div className="l">غیرفعال</div></div>
        </div>

        <TrainsTableClient
          trains={trains}
          totalRows={totalRows}
          params={params}
          allLines={allLines}
          trainTypes={trainTypes}
          canManage={canManage}
        />
      </div>
    </>
  );
}
