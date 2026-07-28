import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { getCachedLookup } from "@/lib/lookups";
import Link from "next/link";
import TrainsTableClient from "./TrainsTableClient";

export const dynamic = "force-dynamic";

export default async function TrainsPage() {
  const session = await getSession();
  const canManage = session ? await hasPerm(session, "train.manage") : false;

  const [trains, trainTypeLookup] = await Promise.all([
    prisma.train.findMany({
      orderBy: { code: "asc" },
      include: { line: true },
    }),
    getCachedLookup("train_type"),
  ]);

  const trainTypes = trainTypeLookup?.values || [];

  const ac = trains.filter((t) => t.type === 0 && !t.isDisposed).length;
  const dc = trains.filter((t) => t.type === 1 && !t.isDisposed).length;
  const diesel = trains.filter((t) => t.type === 2 && !t.isDisposed).length;
  const disposed = trains.filter((t) => t.isDisposed).length;

  return (
    <>
      <div className="topbar">
        <h1>مدیریت قطارها</h1>
        <span className="spacer" />
        {canManage && <Link href="/trains/new" className="btn accent sm">+ افزودن قطار</Link>}
      </div>
      <div className="content">
        <div className="tiles">
          <div className="tile"><div className="n">{trains.length}</div><div className="l">کل قطارها</div></div>
          <div className="tile"><div className="n rail">{ac}</div><div className="l">AC</div></div>
          <div className="tile"><div className="n warn">{dc}</div><div className="l">DC</div></div>
          <div className="tile"><div className="n info">{diesel}</div><div className="l">دیزل</div></div>
          <div className="tile"><div className="n">{disposed}</div><div className="l">غیرفعال</div></div>
        </div>

        <TrainsTableClient trains={trains} trainTypes={trainTypes} canManage={canManage} />
      </div>
    </>
  );
}
