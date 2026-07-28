"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { Role } from "@/lib/enums";
import NotificationBell from "@/components/NotificationBell";
import { Icons } from "@/lib/icons";
import { motion } from "motion/react";
import { useTheme } from "@/components/ThemeProvider";

export default function Sidebar({
  userId,
  fullName,
  role,
  perms = [],
}: {
  userId: number;
  fullName: string;
  role: number;
  perms?: string[];
}) {
  const { appearance } = useTheme();
  const navPos = appearance.navPosition || "right";
  const path = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [branding, setBranding] = useState({
    title: "سامانه مدیریت مانور",
    footer: "پایانه فتح‌آباد · v3",
    logoIcon: "🚇",
    logoType: "icon",
    logoImage: "",
  });

  useEffect(() => {
    // بارگذاری تنظیمات برندینگ
    import("@/app/actions/lookups").then((m) => {
      m.getBrandingSettings().then((res) => {
        if (res) setBranding(res);
      });
    });

    // ثبت‌نام در رویدادهای زنده SSE برای بروزرسانی درجا و آنی برندینگ
    const eventSource = new EventSource("/api/events");
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload && payload.channel === "branding_changed") {
          setBranding(payload.data);
          // اعمال داینامیک رنگ تم در لحظه
          const accentColor = payload.data.accentColor || "#d8842a";
          document.documentElement.style.setProperty("--accent", accentColor, "important");
          document.documentElement.style.setProperty("--accent-soft", `${accentColor}14`, "important");
          document.documentElement.style.setProperty("--accent-hover", `${accentColor}d9`, "important");
        }
      } catch {}
    };

    // بارگذاری حالت جمع‌شده از لوکال استوریج
    const stored = localStorage.getItem("sidebar_collapsed") === "true";
    setIsCollapsed(stored);
    const shell = document.querySelector(".shell");
    if (shell) {
      if (stored) {
        shell.classList.add("collapsed-sidebar");
      } else {
        shell.classList.remove("collapsed-sidebar");
      }
    }

    return () => {
      eventSource.close();
    };
  }, []);

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem("sidebar_collapsed", String(nextState));
    const shell = document.querySelector(".shell");
    if (shell) {
      if (nextState) {
        shell.classList.add("collapsed-sidebar");
      } else {
        shell.classList.remove("collapsed-sidebar");
      }
    }
  };

  const isManager = role === 1 || role === 2 || role === 4;
  const isAdmin = role === 1 || role === 4;

  const dynamicNav = [
    { grp: "عملیات پایانه" },
    { href: "/depot", icKey: "Depot", label: "نمای پایانه", perm: "depot.view" },
    { href: "/dashboard", icKey: "Dashboard", label: "داشبورد و آمار", perm: "dashboard.view" },
    { href: "/manovrs/approvals", icKey: "Approvals", label: "تأیید و کنترل مانورها", perm: "manovr.confirm" },
    { href: "/manovrs", icKey: "History", label: "تاریخچه مانورها", perm: "manovr.view" },
    { href: "/manovrs/new", icKey: "NewManovr", label: "ثبت مانور جدید", perm: "manovr.create" },
    { grp: "اطلاعات پایه" },
    { href: "/trains", icKey: "Trains", label: "مدیریت قطارها", perm: "train.manage" },
    { href: "/lines", icKey: "Lines", label: "مدیریت خطوط ریل", perm: "line.manage" },
    { href: "/users", icKey: "Users", label: "کاربران و پرسنل", perm: "user.manage" },
    { href: "/roles", icKey: "Roles", label: "مدیریت نقش‌ها", perm: "role.manage" },
    { href: "/phonebook", icKey: "Phonebook", label: "دفتر تلفن پرسنل", perm: "phonebook.view" },
    { grp: "تحلیل و تنظیمات" },
    { href: "/profile", icKey: "Profile", label: "پروفایل من" },
    { href: "/tickets", icKey: "Tickets", label: "تیکت‌های پشتیبانی", perm: "ticket.create" },
    { href: "/reports", icKey: "Reports", label: "گزارش‌ساز پویا", perm: "report.build" },
    { href: "/settings", icKey: "Settings", label: "شخصی‌سازی تم" },
    { href: "/admin/terminals", icKey: "Lookups", label: "مدیریت ترمینال‌ها", perm: "terminal.manage" },
    { href: "/admin/lookups", icKey: "Lookups", label: "مدیریت مقادیر پویا", perm: "lookups.manage" },
    { href: "/admin/branding", icKey: "Branding", label: "تنظیمات برندینگ", perm: "branding.manage" },
    { href: "/admin/audit", icKey: "Audit", label: "لاگ وقایع سیستم", perm: "audit.view" },
    { href: "/admin/backup", icKey: "Backup", label: "پشتیبان‌گیری سیستم", perm: "backup.manage" },
  ];

  // بررسی دسترسی کاربر به یک لینک خاص
  const hasPermission = (perm?: string) => {
    if (role === 4) return true; // سوپرادمین به همه جا دسترسی دارد
    if (!perm) return true;
    return perms.includes(perm);
  };

  // فیلتر کردن منوهای ناوبری بر اساس مجوزها
  const filteredNav = React.useMemo(() => {
    const allowedItems = dynamicNav.filter((n) => {
      if ("href" in n && n.perm) {
        return hasPermission(n.perm);
      }
      return true;
    });

    const result: any[] = [];
    for (let i = 0; i < allowedItems.length; i++) {
      const current = allowedItems[i];
      if ("grp" in current) {
        let hasChildren = false;
        for (let j = i + 1; j < allowedItems.length; j++) {
          const next = allowedItems[j];
          if ("grp" in next) break;
          if ("href" in next) {
            hasChildren = true;
            break;
          }
        }
        if (hasChildren) {
          result.push(current);
        }
      } else {
        result.push(current);
      }
    }
    return result;
  }, [perms, role]);

  const isLinkActive = (href: string) => {
    if (href === "/manovrs") {
      return path === href;
    }
    return path === href || (path.startsWith(href) && href !== "/dashboard" && href !== "/depot");
  };

  const LogoIcon = Icons.Trains;

  return (
    <aside className="sidebar">
      <div className="brand" style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", width: "100%", justifyContent: isCollapsed ? "center" : "flex-start" }}>
          <div className="logo" style={{
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px",
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            overflow: "hidden"
          }} onClick={toggleSidebar} title="تغییر وضعیت منو">
            {branding.logoType === "image" && branding.logoImage ? (
              <img src={branding.logoImage} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span>{branding.logoIcon || "🚇"}</span>
            )}
          </div>
          {!isCollapsed && (
            <div style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", flex: 1 }}>
              <b>{branding.title}</b>
              <div className="sub">{branding.footer}</div>
            </div>
          )}
          {!isCollapsed && (
            <div style={{ marginInlineStart: "auto" }}>
              <NotificationBell userId={userId} />
            </div>
          )}
        </div>

        {/* دکمه جمع‌کردن منو */}
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: isCollapsed ? "center" : "flex-end",
            borderTop: isCollapsed ? "none" : "1px solid var(--line-soft)",
            paddingTop: isCollapsed ? 0 : "8px",
          }}
        >
          <button
            onClick={toggleSidebar}
            style={{
              border: "none",
              background: "none",
              color: "var(--ink-soft)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px",
              borderRadius: "4px",
              transition: "var(--transition-fluid)",
            }}
            title={isCollapsed ? "گسترش منو" : "جمع کردن منو"}
          >
            {isCollapsed 
              ? (navPos === "left" ? <Icons.CaretRight size={16} weight="bold" /> : <Icons.CaretLeft size={16} weight="bold" />) 
              : (navPos === "left" ? <Icons.CaretLeft size={16} weight="bold" /> : <Icons.CaretRight size={16} weight="bold" />)}
          </button>
        </div>
      </div>

      <nav className="nav">
        {filteredNav.map((n, i) => {
          if ("grp" in n) {
            if (isCollapsed) return null;
            return (
              <div className="grp" key={`grp-${i}`}>
                {n.grp}
              </div>
            );
          }

          const IconComponent = Icons[n.icKey as keyof typeof Icons];
          const active = isLinkActive(n.href!);

          return (
            <motion.div
              key={n.href}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.02, ease: [0.32, 0.72, 0, 1] }}
            >
              <Link href={n.href!} className={active ? "active" : ""} title={isCollapsed ? n.label : undefined}>
                <span className="ic">
                  {IconComponent && <IconComponent size={18} weight={active ? "bold" : "regular"} />}
                </span>
                {!isCollapsed && <span>{n.label}</span>}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      <div className="side-foot">
        {!isCollapsed && <div className="who">{fullName || "کاربر"}</div>}
        {!isCollapsed && <div className="role">{Role[role] ?? "—"}</div>}
        <form action={logoutAction} style={{ marginTop: isCollapsed ? 0 : 12 }}>
          <button
            className="btn sm primary"
            style={{
              width: isCollapsed ? "40px" : "100%",
              height: isCollapsed ? "40px" : "auto",
              borderRadius: isCollapsed ? "50%" : "var(--r-sm)",
              justifyContent: "center",
              padding: isCollapsed ? "0" : "8px 12px",
            }}
            title="خروج از سیستم"
          >
            <Icons.Logout size={14} weight="bold" style={{ marginInlineEnd: isCollapsed ? 0 : 4 }} />
            {!isCollapsed && <span>خروج</span>}
          </button>
        </form>

        <div style={{
          marginTop: "16px",
          borderTop: "1px dashed var(--line-soft)",
          paddingTop: "10px",
          textAlign: "center",
          fontSize: "10px",
          color: "var(--ink-faint)",
          direction: "rtl"
        }}>
          {isCollapsed ? (
            <span title="برنامه‌نویسی و توسعه: سید شبیر موسوی">© ش.م.</span>
          ) : (
            <div>
              حق تکثیر محفوظ است © ۲۰۲۶
              <div style={{ marginTop: "2px", fontWeight: 500 }}>توسعه توسط سید شبیر موسوی</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
