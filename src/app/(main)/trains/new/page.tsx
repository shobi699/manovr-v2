import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { redirect } from "next/navigation";
import { getCachedLookup } from "@/lib/lookups";
import NewTrainForm from "./NewTrainForm";

export default async function NewTrainPage() {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "train.manage"))) redirect("/trains");

  const [lines, trainTypeLookup] = await Promise.all([
    prisma.line.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getCachedLookup("train_type"),
  ]);

  return (
    <>
      <div className="topbar"><h1>افزودن قطار جدید</h1></div>
      <div className="content">
        <div className="card">
          <div className="card-body">
            <NewTrainForm lines={lines} trainTypes={trainTypeLookup?.values || []} />
          </div>
        </div>
      </div>
    </>
  );
}
