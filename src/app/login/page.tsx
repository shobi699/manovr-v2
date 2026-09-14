import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "./LoginForm";
import LoginConnectionStatus from "./LoginConnectionStatus";
import { getBrandingSettings } from "@/app/actions/lookups";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const branding = await getBrandingSettings();

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: 14, overflow: "hidden",
              margin: "0 auto 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
              background: branding.logoType === "image" ? "transparent" : "var(--panel)",
            }}
          >
            {branding.logoType === "image" && branding.logoImage ? (
              <img src={branding.logoImage} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span>{branding.logoIcon || "🚇"}</span>
            )}
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{branding.title}</h1>
          <p style={{ margin: "6px 0 0", color: "var(--ink-faint)", fontSize: 13.5 }}>
            {branding.footer}
          </p>
        </div>
        <div className="card">
          <div className="card-body">
            <LoginForm />
            <LoginConnectionStatus />
          </div>
        </div>
        <p style={{ textAlign: "center", color: "var(--ink-faint)", fontSize: 12, marginTop: 16, fontFamily: "var(--mono)" }}>
          تهیه شده در عملیات خط یک شرکت بهره برداری مترو تهران
        </p>
        <div style={{
          textAlign: "center",
          color: "var(--ink-faint)",
          fontSize: "11px",
          marginTop: "24px",
          borderTop: "1px dashed var(--line-soft)",
          paddingTop: "14px",
        }}>
          برنامه‌نویسی و توسعه توسط <b>سید شبیر موسوی</b>
          <div style={{ marginTop: "4px", fontSize: "10px" }}>سامانه نسخه ۰.۱.۱ • حق تکثیر محفوظ است © ۲۰۲۶</div>
        </div>
      </div>
    </div>
  );
}
