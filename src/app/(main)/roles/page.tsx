import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm, PERM_LABELS, ALL_PERMS, PERM_GROUPS } from "@/lib/perms";
import { redirect } from "next/navigation";
import RolesFormClient from "./RolesFormClient";
import RoleCardItem from "./RoleCardItem";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "role.view"))) {
    redirect("/dashboard");
  }

  const canCreate = await hasPerm(session, "role.create");
  const canEdit = await hasPerm(session, "role.edit");
  const canDelete = await hasPerm(session, "role.delete");

  const roles = await prisma.accessRole.findMany({
    orderBy: { id: "asc" },
    include: {
      _count: {
        select: { personnel: true },
      },
    },
  });

  return (
    <>
      <div className="topbar">
        <h1>مدیریت نقش‌ها و سطوح دسترسی</h1>
      </div>
      <div className="content" style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: "24px", alignItems: "start" }}>
        {/* ستون کارت‌های نقش موجود */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>
              نقش‌های تعریف‌شده در سامانه ({roles.length})
            </h2>
            <span className="muted" style={{ fontSize: "12px" }}>
              مجموع اختیارات سیستمی: {ALL_PERMS.length} مجوز در {Object.keys(PERM_GROUPS).length} دسته
            </span>
          </div>

          {roles.map((role) => (
            <RoleCardItem
              key={role.id}
              role={role}
              allPerms={ALL_PERMS}
              permLabels={PERM_LABELS}
              permGroups={PERM_GROUPS}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))}
        </div>

        {/* ستون فرم ایجاد نقش جدید */}
        {canCreate && (
          <div>
            <div className="card" style={{ position: "sticky", top: "80px", border: "1px solid var(--line)", borderRadius: "10px" }}>
              <div className="card-head" style={{ borderBottom: "1px solid var(--line)", padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "18px" }}>✨</span>
                  <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>ایجاد نقش جدید</h2>
                </div>
              </div>
              <div className="card-body" style={{ padding: "18px" }}>
                <RolesFormClient
                  mode="create"
                  allPerms={ALL_PERMS}
                  permLabels={PERM_LABELS}
                  permGroups={PERM_GROUPS}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
