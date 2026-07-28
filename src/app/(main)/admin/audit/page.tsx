import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import AuditLogsClient from "./AuditLogsClient";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const canView = await hasPerm(session, "audit.view");
  if (!canView) {
    return (
      <div className="content" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div className="card" style={{ padding: "40px", textAlign: "center", maxWidth: "450px" }}>
          <span style={{ fontSize: "48px" }}>⚠️</span>
          <h2 style={{ marginTop: "16px", color: "var(--crit)" }}>عدم دسترسی کافی</h2>
          <p className="muted" style={{ marginTop: "8px" }}>
            شما مجوز لازم برای مشاهده لاگ‌های امنیتی و وقایع سیستم را ندارید.
          </p>
        </div>
      </div>
    );
  }

  // بارگذاری ۱۰۰ لاگ اخیر سیستم
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <div className="topbar">
        <h1>لاگ وقایع و رهگیری تغییرات سیستم (Audit Log)</h1>
      </div>
      <div className="content">
        <AuditLogsClient initialLogs={logs as any[]} />
      </div>
    </>
  );
}
