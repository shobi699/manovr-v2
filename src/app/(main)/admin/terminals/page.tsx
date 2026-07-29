import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import TerminalsClient from "./TerminalsClient";

export const dynamic = "force-dynamic";

export default async function AdminTerminalsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const canView = await hasPerm(session, "terminal.view");
  if (!canView) {
    return (
      <div className="content" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div className="card" style={{ padding: "40px", textAlign: "center", maxWidth: "450px" }}>
          <span style={{ fontSize: "48px" }}>⚠️</span>
          <h2 style={{ marginTop: "16px", color: "var(--crit)" }}>عدم دسترسی کافی</h2>
          <p className="muted" style={{ marginTop: "8px" }}>
            شما مجوز لازم برای مدیریت ترمینال‌های پایانه را ندارید.
          </p>
        </div>
      </div>
    );
  }

  const canCreate = await hasPerm(session, "terminal.create");
  const canEdit = await hasPerm(session, "terminal.edit");
  const canDelete = await hasPerm(session, "terminal.delete");

  // دریافت اطلاعات نوع لوکاپ ترمینال
  const terminalType = await prisma.lookupType.findUnique({
    where: { key: "terminal" },
    include: {
      values: {
        orderBy: { sortIdx: "asc" },
      },
    },
  });

  const lines = await prisma.line.findMany({
    select: {
      id: true,
      name: true,
      terminal: true,
    },
  });

  return (
    <div className="content">
      <TerminalsClient
        typeId={terminalType?.id || 0}
        initialTerminals={terminalType?.values || []}
        lines={lines}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}
