import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import LookupsClient from "./LookupsClient";

export const dynamic = "force-dynamic";

export default async function AdminLookupsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const canManage = await hasPerm(session, "lookups.manage");
  if (!canManage) {
    return (
      <div className="content" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div className="card" style={{ padding: "40px", textAlign: "center", maxWidth: "450px" }}>
          <span style={{ fontSize: "48px" }}>⚠️</span>
          <h2 style={{ marginTop: "16px", color: "var(--crit)" }}>عدم دسترسی کافی</h2>
          <p className="muted" style={{ marginTop: "8px" }}>
            شما مجوز لازم برای مدیریت تعاریف و مقادیر پایه سیستم را ندارید.
          </p>
        </div>
      </div>
    );
  }

  // بارگذاری تمام تعاریف به انضمام مقادیر
  const types = await prisma.lookupType.findMany({
    include: {
      values: {
        orderBy: { sortIdx: "asc" },
      },
    },
  });

  return (
    <>
      <div className="topbar">
        <h1>مدیریت مقادیر پویا و لوکاپ‌های سیستم (لوکاپ موتور)</h1>
      </div>
      <div className="content">
        <LookupsClient initialTypes={types} />
      </div>
    </>
  );
}
