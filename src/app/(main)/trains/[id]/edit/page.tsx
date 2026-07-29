import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { redirect, notFound } from "next/navigation";
import { getCachedLookup } from "@/lib/lookups";
import EditTrainForm from "./EditTrainForm";

export default async function EditTrainPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "train.edit"))) redirect("/trains");

  const { id } = await params;
  const [train, lines, trainTypeLookup] = await Promise.all([
    prisma.train.findUnique({ where: { id: Number(id) } }),
    prisma.line.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getCachedLookup("train_type"),
  ]);

  if (!train) notFound();

  return (
    <>
      <div className="topbar"><h1>ویرایش قطار: {train.code}</h1></div>
      <div className="content">
        <div className="card">
          <div className="card-body">
              <EditTrainForm
                train={{
                  id: train.id,
                  code: train.code,
                  type: train.type,
                  lineId: train.lineId,
                  isDisposed: train.isDisposed,
                  hasKafshak: (train as any).hasKafshak ?? false,
                  noAtp: (train as any).noAtp ?? false,
                  movadDavvar: (train as any).movadDavvar ?? null,
                  noLicense: (train as any).noLicense ?? false,
                }}
                lines={lines}
                trainTypes={trainTypeLookup?.values || []}
                canEditKafshak={await hasPerm(session, "train.status.kafshak")}
                canEditAtp={await hasPerm(session, "train.status.atp")}
                canEditRotary={await hasPerm(session, "train.status.rotary")}
                canEditLicense={await hasPerm(session, "train.status.license")}
              />
          </div>
        </div>
      </div>
    </>
  );
}
