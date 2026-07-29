"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { updateUserProfile, updateUserSecurity } from "@/app/actions/profile";
import { Role, OrgPosition, Shift } from "@/lib/enums";


interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  userName: string;
  role: number;
  shift: number;
  orgPosition: number;
  personnelCode: string;
  phone1: string;
  phone2: string;
  internalTel: string;
  address: string;
  avatarColor: string;
  roleName: string;
}

interface UserStats {
  manovrsCreated: number;
  activeTickets: number;
  totalTickets: number;
}

interface ActivityLog {
  id: number;
  action: string;
  summary: string;
  createdAt: string;
}

const AVATAR_COLORS = [
  "#4b5563", // خاکستری
  "#d8842a", // نارنجی برندینگ
  "#3b82f6", // آبی
  "#10b981", // سبز
  "#ef4444", // قرمز
  "#8b5cf6", // بنفش
  "#ec4899", // صورتی
  "#0ea5e9", // آسمانی
];

export default function ProfileClient({
  user,
  stats,
  recentLogs,
  logPage = 1,
  totalLogsCount = 0,
}: {
  user: UserProfile;
  stats: UserStats;
  recentLogs: ActivityLog[];
  logPage?: number;
  totalLogsCount?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [profileForm, setProfileForm] = useState({
    phone1: user.phone1,
    phone2: user.phone2,
    internalTel: user.internalTel,
    address: user.address,
    avatarColor: user.avatarColor,
  });

  const [securityForm, setSecurityForm] = useState({
    userName: user.userName,
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [isProfilePending, startProfileTransition] = useTransition();
  const [isSecurityPending, startSecurityTransition] = useTransition();

  // فرمت تاریخ جلالی برای وقایع
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      calendar: "persian",
      timeZone: "Asia/Tehran",
    });
  };

  // ذخیره اطلاعات پروفایل
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    startProfileTransition(async () => {
      const res = await updateUserProfile(profileForm);
      if (res.error) {
        alert(res.error);
      } else {
        alert("اطلاعات عمومی پروفایل با موفقیت بروزرسانی شد.");
      }
    });
  };

  // ذخیره تغییرات امنیت
  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    if (securityForm.newPassword && securityForm.newPassword !== securityForm.confirmPassword) {
      alert("رمز عبور جدید با تکرار آن مطابقت ندارد.");
      return;
    }

    startSecurityTransition(async () => {
      const res = await updateUserSecurity({
        userName: securityForm.userName,
        currentPassword: securityForm.currentPassword || undefined,
        newPassword: securityForm.newPassword || undefined,
      });
      if (res.error) {
        alert(res.error);
      } else {
        alert("اطلاعات کاربری و رمز عبور با موفقیت بروزرسانی شد.");
        setSecurityForm({
          ...securityForm,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }} className="profile-container">
      
      {/* ردیف بالا: آمارهای کلی */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        
        <div className="card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "16px", borderRight: "4px solid var(--accent)" }}>
          <div style={{ fontSize: "28px" }}>📝</div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--ink-soft)" }}>مانورهای ثبت شده شما</div>
            <div style={{ fontSize: "22px", fontWeight: "bold", marginTop: "4px" }}>
              {stats.manovrsCreated.toLocaleString("fa-IR")}
            </div>
          </div>
        </div>

        <Link href="/tickets" className="card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "16px", borderRight: "4px solid var(--crit)", textDecoration: "none", color: "inherit" }}>
          <div style={{ fontSize: "28px" }}>🎫</div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--ink-soft)" }}>تیکت‌های فعال شما</div>
            <div style={{ fontSize: "22px", fontWeight: "bold", marginTop: "4px" }}>
              {stats.activeTickets.toLocaleString("fa-IR")}
            </div>
          </div>
        </Link>

        <Link href="/tickets" className="card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "16px", borderRight: "4px solid var(--rail)", textDecoration: "none", color: "inherit" }}>
          <div style={{ fontSize: "28px" }}>📁</div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--ink-soft)" }}>کل تیکت‌های پشتیبانی</div>
            <div style={{ fontSize: "22px", fontWeight: "bold", marginTop: "4px" }}>
              {stats.totalTickets.toLocaleString("fa-IR")}
            </div>
          </div>
        </Link>

      </div>

      {/* بخش اصلی: اطلاعات شخصی و امنیت */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
        
        {/* ستون راست: اطلاعات عمومی و تماس */}
        <div className="card" style={{ padding: "20px" }}>
          <div className="card-head" style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--line)", marginBottom: "20px" }}>
            <h2>👤 مشخصات عمومی و اطلاعات تماس</h2>
          </div>

          <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* بخش آواتار و نام کاربر */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", paddingBottom: "16px", borderBottom: "1px dashed var(--line-soft)" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  backgroundColor: profileForm.avatarColor,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  fontWeight: "bold",
                  boxShadow: "var(--sh-1)",
                }}
              >
                {user.firstName[0]}
              </div>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>
                  {user.firstName} {user.lastName}
                </h3>
                <span className="pill p-mut" style={{ fontSize: "11px", marginTop: "4px", display: "inline-block" }}>
                  کد پرسنلی: {user.personnelCode}
                </span>
              </div>
            </div>

            {/* انتخاب رنگ آواتار */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", color: "var(--ink-soft)" }}>رنگ آیکون پروفایل:</label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setProfileForm({ ...profileForm, avatarColor: color })}
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      backgroundColor: color,
                      border: profileForm.avatarColor === color ? "2px solid var(--ink)" : "2px solid transparent",
                      cursor: "pointer",
                      padding: 0,
                      boxShadow: "inset 0 0 4px rgba(0,0,0,0.1)",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* فیلدهای سیستمی (غیرقابل ویرایش توسط خود کاربر) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", color: "var(--ink-faint)" }}>نقش کاربری</span>
                <input
                  type="text"
                  disabled
                  value={user.roleName || Role[user.role] || "—"}
                  style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel-2)", color: "var(--ink-soft)" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", color: "var(--ink-faint)" }}>شیفت کاری</span>
                <input
                  type="text"
                  disabled
                  value={`شیفت ${Shift[user.shift] || user.shift}`}
                  style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel-2)", color: "var(--ink-soft)" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", color: "var(--ink-faint)" }}>سمت سازمانی</span>
                <input
                  type="text"
                  disabled
                  value={OrgPosition[user.orgPosition] || "—"}
                  style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel-2)", color: "var(--ink-soft)" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", color: "var(--ink-faint)" }}>شناسه کاربری</span>
                <input
                  type="text"
                  disabled
                  value={`#${user.id}`}
                  style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel-2)", color: "var(--ink-soft)" }}
                />
              </div>
            </div>

            {/* فیلدهای قابل ویرایش */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label htmlFor="phone1" style={{ fontSize: "13px", fontWeight: 650 }}>تلفن همراه ۱:</label>
              <input
                type="text"
                id="phone1"
                value={profileForm.phone1}
                onChange={(e) => setProfileForm({ ...profileForm, phone1: e.target.value })}
                placeholder="مثال: 09121111111"
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label htmlFor="phone2" style={{ fontSize: "13px", fontWeight: 650 }}>تلفن همراه ۲:</label>
              <input
                type="text"
                id="phone2"
                value={profileForm.phone2}
                onChange={(e) => setProfileForm({ ...profileForm, phone2: e.target.value })}
                placeholder="تلفن پشتیبان یا اضطراری"
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label htmlFor="internalTel" style={{ fontSize: "13px", fontWeight: 650 }}>تلفن داخلی پایانه:</label>
              <input
                type="text"
                id="internalTel"
                value={profileForm.internalTel}
                onChange={(e) => setProfileForm({ ...profileForm, internalTel: e.target.value })}
                placeholder="تلفن داخلی محل کار"
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label htmlFor="address" style={{ fontSize: "13px", fontWeight: 650 }}>آدرس محل سکونت:</label>
              <textarea
                id="address"
                rows={2}
                value={profileForm.address}
                onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                placeholder="جهت هماهنگی سرویس‌های پرسنلی..."
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)", fontFamily: "inherit", resize: "none" }}
              />
            </div>

            <button
              type="submit"
              disabled={isProfilePending}
              className="btn primary"
              style={{ marginTop: "8px", justifyContent: "center" }}
            >
              {isProfilePending ? "در حال ذخیره‌سازی..." : "💾 ذخیره اطلاعات تماس"}
            </button>

          </form>
        </div>

        {/* ستون چپ: امنیت، رمز عبور و فعالیت اخیر */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* کارت امنیت و تغییر رمز */}
          <div className="card" style={{ padding: "20px" }}>
            <div className="card-head" style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--line)", marginBottom: "20px" }}>
              <h2>🔒 امنیت و رمز عبور</h2>
            </div>
            
            <form onSubmit={handleSaveSecurity} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label htmlFor="userName" style={{ fontSize: "13px", fontWeight: 650 }}>نام کاربری (جهت ورود):</label>
                <input
                  type="text"
                  id="userName"
                  value={securityForm.userName}
                  onChange={(e) => setSecurityForm({ ...securityForm, userName: e.target.value })}
                  style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)" }}
                  required
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label htmlFor="currentPassword" style={{ fontSize: "13px", fontWeight: 650 }}>رمز عبور فعلی:</label>
                <input
                  type="password"
                  id="currentPassword"
                  value={securityForm.currentPassword}
                  onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
                  placeholder="رمز عبور فعلی خود را وارد کنید"
                  style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label htmlFor="newPassword" style={{ fontSize: "13px", fontWeight: 650 }}>رمز عبور جدید:</label>
                  <input
                    type="password"
                    id="newPassword"
                    value={securityForm.newPassword}
                    onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                    placeholder="رمز جدید"
                    style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label htmlFor="confirmPassword" style={{ fontSize: "13px", fontWeight: 650 }}>تکرار رمز جدید:</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={securityForm.confirmPassword}
                    onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })}
                    placeholder="تکرار رمز جدید"
                    style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)" }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSecurityPending}
                className="btn primary"
                style={{ marginTop: "8px", justifyContent: "center" }}
              >
                {isSecurityPending ? "در حال تغییر مشخصات..." : "🔑 تغییر نام کاربری / رمز ورود"}
              </button>

            </form>
          </div>

          {/* کارت آخرین فعالیت‌ها */}
          <div className="card" style={{ padding: "20px", flex: 1 }}>
            <div className="card-head" style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--line)", marginBottom: "16px" }}>
              <h2>📜 لاگ آخرین فعالیت‌های شما</h2>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", minHeight: "250px" }}>
              {recentLogs.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "var(--ink-soft)", fontSize: "12px" }}>
                  هیچ لاگ فعالیتی اخیراً ثبت نشده است.
                </div>
              ) : (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--line-soft)",
                      backgroundColor: "rgba(30,41,59,0.01)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", fontWeight: "bold", color: "var(--accent)" }}>
                        {log.action === "CREATE" ? "ایجاد 🟢" : log.action === "UPDATE" ? "ویرایش 🔵" : log.action === "DELETE" ? "حذف 🔴" : "تأیید 🟡"}
                      </span>
                      <span style={{ fontSize: "10px", color: "var(--ink-faint)", fontFamily: "var(--mono)" }}>
                        {formatDate(log.createdAt)}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "11.5px", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                      {log.summary}
                    </p>
                  </div>
                ))
              )}
            </div>

            {totalLogsCount > 10 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
                <button 
                  className="btn outline"
                  style={{ padding: "4px 8px", fontSize: "12px" }}
                  disabled={logPage <= 1}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("logPage", (logPage - 1).toString());
                    router.push(pathname + "?" + params.toString(), { scroll: false });
                  }}
                >
                  صفحه قبل
                </button>
                <span style={{ fontSize: "12px", color: "var(--ink-soft)" }}>
                  صفحه {logPage} از {Math.ceil(totalLogsCount / 10)}
                </span>
                <button 
                  className="btn outline"
                  style={{ padding: "4px 8px", fontSize: "12px" }}
                  disabled={logPage >= Math.ceil(totalLogsCount / 10)}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("logPage", (logPage + 1).toString());
                    router.push(pathname + "?" + params.toString(), { scroll: false });
                  }}
                >
                  صفحه بعد
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
