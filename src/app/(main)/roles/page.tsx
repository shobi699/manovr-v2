import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm, PERM_LABELS, ALL_PERMS } from "@/lib/perms";
import { redirect } from "next/navigation";
import RolesFormClient from "./RolesFormClient";

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
      <div className="content" style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {roles.map((role) => {
            let permsList: string[] = [];
            try {
              permsList = JSON.parse(role.permissions);
            } catch {
              permsList = [];
            }
            return (
              <div className="card" key={role.id}>
                <div className="card-head">
                  <h2>
                    {role.name}
                    {role.isSystem && (
                      <span className="pill p-rail" style={{ marginRight: 8, fontSize: 10 }}>
                        سیستمی
                      </span>
                    )}
                  </h2>
                  <span className="spacer" />
                  <span className="muted" style={{ fontSize: 12 }}>
                    تعداد کاربران: {role._count.personnel}
                  </span>
                </div>
                <div className="card-body">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                    {permsList.length === 0 ? (
                      <span className="muted">بدون دسترسی</span>
                    ) : (
                      permsList.map((p) => (
                        <span className="pill p-mut" key={p}>
                          {(PERM_LABELS as any)[p] || p}
                        </span>
                      ))
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <RolesFormClient
                      mode="edit"
                      roleId={role.id}
                      roleName={role.name}
                      activePerms={permsList}
                      allPerms={ALL_PERMS}
                      permLabels={PERM_LABELS}
                      isSystem={role.isSystem}
                      canEdit={canEdit}
                      canDelete={canDelete}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {canCreate && (
          <div>
            <div className="card" style={{ position: "sticky", top: "80px" }}>
              <div className="card-head">
                <h2>ایجاد نقش جدید</h2>
              </div>
              <div className="card-body">
                <RolesFormClient
                  mode="create"
                  allPerms={ALL_PERMS}
                  permLabels={PERM_LABELS}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
