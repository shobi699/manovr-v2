import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { Shift, OrgPosition } from "@/lib/enums";
import PhonebookClient from "./PhonebookClient";

export const dynamic = "force-dynamic";

export default async function PhonebookPage() {
  const session = await getSession();
  const canEdit = session ? await hasPerm(session, "phonebook.edit") : false;

  const personnel = await prisma.personnel.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

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
          canEdit={canEdit}
          shifts={Shift}
          positions={OrgPosition}
        />
      </div>
    </>
  );
}
