import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { redirect } from "next/navigation";
import HelpClient from "./HelpClient";

export const metadata = {
  title: "راهنما و آموزش سامانه | سامانه مدیریت مانور و دپو",
  description: "راهنمای جامع کاربری، دانشنامه تخصصی پایانه و کلیدهای میانبر سامانه مانور و دپو",
};

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (!(await hasPerm(session, "help.view"))) {
    redirect("/dashboard");
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
            📖 راهنما، آموزش و دانشنامه تخصصی سامانه
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", opacity: 0.8 }}>
            راهنمای عملیات دپو، ثبت مانور، اصطلاحات فنی پایانه فتح‌آباد و کلیدهای میانبر
          </p>
        </div>
      </div>
      <div className="content" style={{ maxWidth: 1100 }}>
        <HelpClient userRole={session.role} />
      </div>
    </>
  );
}
