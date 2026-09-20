import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import { getBrandingSettings } from "@/app/actions/lookups";
import { getUserPerms } from "@/lib/perms";
import { prisma } from "@/lib/prisma";
import { ContextMenuProvider } from "@/components/context-menu";
import OfflineBanner from "@/components/OfflineBanner";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [perms, branding, currentUser] = await Promise.all([
    getUserPerms(session.id, session.role),
    getBrandingSettings(),
    prisma.personnel.findUnique({
      where: { id: session.id },
      select: { accessRole: { select: { name: true } } },
    }),
  ]);

  const roleName = currentUser?.accessRole?.name;

  return (
    <ContextMenuProvider>
      <div className="shell">
        <Sidebar userId={session.id} fullName={session.fullName} role={session.role} roleName={roleName} perms={perms} />
        <main className="main">
          <OfflineBanner />

          {branding.announcementActive && branding.announcementText && (
          <div className={`banner-${branding.announcementKind}`} style={{
            padding: "12px 18px",
            backgroundColor: branding.announcementKind === "alert" ? "var(--crit-soft)" : branding.announcementKind === "warning" ? "var(--warn-soft)" : branding.announcementKind === "success" ? "var(--good-soft)" : "var(--accent-soft)",
            borderRight: `4px solid ${branding.announcementKind === "alert" ? "var(--crit)" : branding.announcementKind === "warning" ? "var(--warn)" : branding.announcementKind === "success" ? "var(--good)" : "var(--accent)"}`,
            color: "var(--ink)",
            fontSize: "13px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "20px",
            borderRadius: "6px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}>
            <span style={{ fontSize: "16px" }}>
              {branding.announcementKind === "alert" ? "🚨" : branding.announcementKind === "warning" ? "⚠️" : branding.announcementKind === "success" ? "🟢" : "📢"}
            </span>
            <span style={{ flex: 1 }}>{branding.announcementText}</span>
          </div>
        )}
        {children}
      </main>
      </div>
    </ContextMenuProvider>
  );
}

