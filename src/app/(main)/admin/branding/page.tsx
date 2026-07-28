import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { getBrandingSettings } from "@/app/actions/lookups";
import BrandingClient from "./BrandingClient";

export const dynamic = "force-dynamic";

export default async function AdminBrandingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const canManage = await hasPerm(session, "branding.manage");
  if (!canManage) {
    return (
      <div className="content" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div className="card" style={{ padding: "40px", textAlign: "center", maxWidth: "450px" }}>
          <span style={{ fontSize: "48px" }}>⚠️</span>
          <h2 style={{ marginTop: "16px", color: "var(--crit)" }}>عدم دسترسی کافی</h2>
          <p className="muted" style={{ marginTop: "8px" }}>
            شما مجوز لازم برای تغییر برندینگ و تنظیمات ظاهری سامانه را ندارید.
          </p>
        </div>
      </div>
    );
  }

  const branding = await getBrandingSettings();

  return (
    <>
      <div className="topbar">
        <h1>شخصی‌سازی نام و پانویس سامانه</h1>
      </div>
      <div className="content">
        <BrandingClient initialSettings={branding} />
      </div>
    </>
  );
}
