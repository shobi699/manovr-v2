import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { redirect } from "next/navigation";
import AboutClient from "./AboutClient";

export const metadata = {
  title: "درباره ما و شناسنامه سامانه | سامانه مدیریت مانور و دپو فتح‌آباد",
  description: "معرفی متولیان سازمانی، مدیریت عملیات خط یک، ریاست پایانه و مانور، تیم توسعه و مشخصات فنی سامانه",
};

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (!(await hasPerm(session, "about.view"))) {
    redirect("/dashboard");
  }

  const currentVersion = "0.1.2";
  const buildDateJalali = "۲۵ شهریور ۱۴۰۵";
  const buildDateGregorian = "2026-09-15";

  return (
    <>
      <div className="topbar">
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
            ℹ️ درباره ما و شناسنامه سامانه
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", opacity: 0.8 }}>
            شناسنامه رسمی، متولیان سازمانی خط یک، تیم مهندسی و مشخصات نگارش نرم‌افزار
          </p>
        </div>
      </div>
      <div className="content" style={{ maxWidth: 1100 }}>
        <AboutClient
          currentVersion={currentVersion}
          buildDateJalali={buildDateJalali}
          buildDateGregorian={buildDateGregorian}
        />
      </div>
    </>
  );
}
