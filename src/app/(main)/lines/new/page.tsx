import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import NewLineForm from "./NewLineForm";

export default async function NewLinePage() {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "line.create"))) redirect("/lines");

  const terminalType = await prisma.lookupType.findUnique({
    where: { key: "terminal" },
    include: {
      values: {
        orderBy: { sortIdx: "asc" },
      },
    },
  });

  const terminals = terminalType?.values || [];

  return (
    <>
      <div className="topbar"><h1>افزودن خط جدید</h1></div>
      <div className="content">
        <div className="card">
          <div className="card-body">
            <NewLineForm terminals={terminals} />
          </div>
        </div>
      </div>
    </>
  );
}
