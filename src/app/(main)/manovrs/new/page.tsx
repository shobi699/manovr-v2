import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { getCachedLookup } from "@/lib/lookups";
import NewManovrForm from "./NewManovrForm";

export const dynamic = "force-dynamic";

export default async function NewManovrPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await hasPerm(session, "manovr.create"))) {
    return (
      <>
        <div className="topbar"><h1>ثبت مانور</h1></div>
        <div className="content">
          <div className="err">شما اجازه ثبت مانور را ندارید.</div>
        </div>
      </>
    );
  }

  const [lines, trains, rahbaran, manovrTypeLookup] = await Promise.all([
    prisma.line.findMany({ orderBy: [{ terminal: "asc" }, { name: "asc" }] }),
    prisma.train.findMany({
      where: { isDisposed: false },
      include: { line: true },
      orderBy: { code: "asc" },
    }),
    prisma.personnel.findMany({
      where: {
        OR: [
          { orgPosition: 1 },
          { isPartTimeDriver: true },
        ],
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    getCachedLookup("manovr_type"),
  ]);

  return (
    <>
      <div className="topbar"><h1>ثبت مانور جدید</h1></div>
      <div className="content">
        <div className="card" style={{ maxWidth: 720 }}>
          <div className="card-body">
            <NewManovrForm
              lines={lines.map((l) => ({ id: l.id, name: l.name }))}
              trains={trains.map((t) => ({
                id: t.id,
                code: t.code,
                lineId: t.lineId,
                lineName: t.line?.name,
                slotIndex: t.slotIndex,
              }))}
              rahbaran={rahbaran.map((p) => ({
                id: p.id,
                name: `${p.firstName} ${p.lastName}${p.isPartTimeDriver && p.orgPosition !== 1 ? " (راهبر غیردائم)" : ""}`.trim(),
              }))}
              manovrTypes={manovrTypeLookup?.values || []}
            />
          </div>
        </div>
      </div>
    </>
  );
}
