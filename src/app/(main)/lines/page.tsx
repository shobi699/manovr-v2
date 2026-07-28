import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import Link from "next/link";
import LinesTableClient from "./LinesTableClient";

export const dynamic = "force-dynamic";

export default async function LinesPage() {
  const session = await getSession();
  const canManage = session ? await hasPerm(session, "line.manage") : false;

  const [lines, terminalType] = await Promise.all([
    prisma.line.findMany({
      orderBy: [{ terminal: "asc" }, { name: "asc" }],
    }),
    prisma.lookupType.findUnique({
      where: { key: "terminal" },
      include: {
        values: {
          orderBy: { sortIdx: "asc" },
        },
      },
    }),
  ]);

  const terminals = terminalType?.values || [];

  return (
    <>
      <div className="topbar">
        <h1>مدیریت خطوط</h1>
        <span className="spacer" />
        {canManage && <Link href="/lines/new" className="btn accent sm">+ افزودن خط</Link>}
      </div>
      <div className="content">
        <LinesTableClient lines={lines} terminals={terminals} canManage={canManage} />
      </div>
    </>
  );
}
