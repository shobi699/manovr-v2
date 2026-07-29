import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { Shift, OrgPosition } from "@/lib/enums";
import { parseListParams, toPrismaPage } from "@/lib/list-query";
import PhonebookClient from "./PhonebookClient";

export const dynamic = "force-dynamic";

const ALLOWED_SORT = ["lastName", "firstName", "personnelCode", "shift", "orgPosition"];

export default async function PhonebookPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  const canEdit = session ? await hasPerm(session, "phonebook.edit") : false;

  const resolvedParams = (await searchParams) || {};
  const params = parseListParams(resolvedParams, ALLOWED_SORT);
  const { skip, take } = toPrismaPage(params);

  const shiftFilter = typeof resolvedParams.shift === "string" ? resolvedParams.shift : "all";
  const posFilter = typeof resolvedParams.pos === "string" ? resolvedParams.pos : "all";

  const where: any = {};
  const andConditions: any[] = [];

  if (shiftFilter !== "all") {
    andConditions.push({ shift: Number(shiftFilter) });
  }
  if (posFilter !== "all") {
    andConditions.push({ orgPosition: Number(posFilter) });
  }

  if (params.search) {
    andConditions.push({
      OR: [
        { firstName: { contains: params.search } },
        { lastName: { contains: params.search } },
        { personnelCode: { contains: params.search } },
        { phone1: { contains: params.search } },
        { internalTel: { contains: params.search } },
      ],
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const orderBy = params.sortField
    ? { [params.sortField]: params.sortDir }
    : [{ lastName: "asc" as const }, { firstName: "asc" as const }];

  const [personnel, totalRows] = await Promise.all([
    prisma.personnel.findMany({
      where,
      orderBy,
      skip,
      take,
    }),
    prisma.personnel.count({ where }),
  ]);

  return (
    <>
      <div className="topbar">
        <h1>دفتر تلفن و دایرکتوری پرسنل</h1>
      </div>
      <div className="content">
        <PhonebookClient
          initialPersonnel={personnel.map((p) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            phone1: p.phone1 || "",
            phone2: p.phone2 || "",
            internalTel: p.internalTel || "",
            address: p.address || "",
            avatarColor: p.avatarColor || "#4b5563",
            shift: p.shift,
            orgPosition: p.orgPosition,
            personnelCode: p.personnelCode || "",
          }))}
          totalRows={totalRows}
          params={params}
          canEdit={canEdit}
          shifts={Shift}
          positions={OrgPosition}
        />
      </div>
    </>
  );
}
