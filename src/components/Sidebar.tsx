"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { Role } from "@/lib/enums";
import NotificationBell from "@/components/NotificationBell";
import { Icons } from "@/lib/icons";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "@/components/ThemeProvider";
import { safeAccentColor } from "@/lib/branding";
import ServerStatusBadge from "@/components/ServerStatusBadge";
import SidebarFlyoutTooltip, { type FlyoutTooltipItem } from "@/components/SidebarFlyoutTooltip";
import { APP_CURRENT_VERSION, APP_BUILD_DATE_JALALI } from "@/lib/version";

interface NavItem {
  href: string;
  icKey: string;
  label: string;
  perm?: string;
}

interface NavSection {
  id: string;
  title: string;
  isCollapsible?: boolean;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: "operations",
    title: "عملیات پایانه",
    items: [
      { href: "/depot", icKey: "Depot", label: "نمای پایانه", perm: "depot.view" },
      { href: "/dashboard", icKey: "Dashboard", label: "داشبورد و آمار", perm: "dashboard.view" },
      { href: "/manovrs/approvals", icKey: "Approvals", label: "تأیید و کنترل مانورها", perm: "manovr.confirm" },
      { href: "/manovrs", icKey: "History", label: "تاریخچه مانورها", perm: "manovr.view" },
      { href: "/manovrs/new", icKey: "NewManovr", label: "ثبت مانور جدید", perm: "manovr.create" },
    ],
  },
  {
    id: "base-info",
    title: "اطلاعات پایه",
    items: [
      { href: "/trains", icKey: "Trains", label: "مدیریت قطارها", perm: "train.view" },
      { href: "/lines", icKey: "Lines", label: "مدیریت خطوط ریل", perm: "line.view" },
      { href: "/users", icKey: "Users", label: "کاربران و پرسنل", perm: "user.view" },
      { href: "/roles", icKey: "Roles", label: "مدیریت نقش‌ها", perm: "role.view" },
      { href: "/phonebook", icKey: "Phonebook", label: "دفتر تلفن پرسنل", perm: "phonebook.view" },
    ],
  },
  {
    id: "analysis",
    title: "تحلیل و تنظیمات",
    isCollapsible: true,
    items: [
      { href: "/profile", icKey: "Profile", label: "پروفایل من" },
      { href: "/tickets", icKey: "Tickets", label: "تیکت‌های پشتیبانی", perm: "ticket.view" },
      { href: "/reports", icKey: "Reports", label: "گزارش‌ساز پویا", perm: "report.build" },
      { href: "/help", icKey: "Help", label: "راهنما و آموزش", perm: "help.view" },
      { href: "/about", icKey: "Info", label: "درباره ما" },
      { href: "/settings", icKey: "Settings", label: "شخصی‌سازی تم" },
      { href: "/admin/terminals", icKey: "Lookups", label: "مدیریت ترمینال‌ها", perm: "terminal.view" },
      { href: "/admin/lookups", icKey: "Lookups", label: "مدیریت مقادیر پویا", perm: "lookups.manage" },
      { href: "/admin/branding", icKey: "Branding", label: "تنظیمات برندینگ", perm: "branding.manage" },
      { href: "/admin/audit", icKey: "Audit", label: "لاگ وقایع سیستم", perm: "audit.view" },
      { href: "/admin/backup", icKey: "Backup", label: "پشتیبان‌گیری سیستم", perm: "backup.manage" },
    ],
  },
];

export default function Sidebar({
  userId,
  fullName,
  role,
  roleName,
  perms = [],
}: {
  userId: number;
  fullName: string;
  role: number;
  roleName?: string;
  perms?: string[];
}) {
  const { appearance } = useTheme();
  const navPos = appearance.navPosition || "right";
  const path = usePathname();

  // مقدار اولیه پایدار برای هماهنگی کامل SSR و کلاینت و جلوگیری از خطای هیدریشن
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(true);
  const [activeTooltip, setActiveTooltip] = useState<FlyoutTooltipItem | null>(null);

  const showTooltip = useCallback(
    (
      e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
      item: Omit<FlyoutTooltipItem, "anchorRect">
    ) => {
      if (!isCollapsed) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setActiveTooltip({
        ...item,
        anchorRect: rect,
      });
    },
    [isCollapsed]
  );

  const hideTooltip = useCallback(() => {
    setActiveTooltip(null);
  }, []);

  const [branding, setBranding] = useState({
    title: "سامانه مدیریت مانور",
    footer: "پایانه فتح‌آباد · v3",
    logoIcon: "🚇",
    logoType: "icon",
    logoImage: "",
  });

  useEffect(() => {
    // بازیابی وضعیت ذخیره‌شده سایدبار در کلاینت پس از هیدریشن موفق
    try {
      const storedCollapsed = localStorage.getItem("sidebar_collapsed");
      if (storedCollapsed !== null) {
        setIsCollapsed(storedCollapsed === "true");
      }
      const storedAnalysis = localStorage.getItem("sidebar_analysis_expanded");
      if (storedAnalysis !== null) {
        setIsAnalysisExpanded(storedAnalysis === "true");
      }
    } catch {}

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
          const accentColor = safeAccentColor(payload.data?.accentColor);
          document.documentElement.style.setProperty("--accent", accentColor, "important");
          document.documentElement.style.setProperty("--accent-soft", `${accentColor}14`, "important");
          document.documentElement.style.setProperty("--accent-hover", `${accentColor}d9`, "important");
        }
      } catch {}
    };

    // همگام‌سازی کلاس‌های منوی جمع‌شده با پوسته
    const stored = localStorage.getItem("sidebar_collapsed") === "true";
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

  // پاکسازی تول‌تیپ فعال در هنگام اسکرول پنجره یا تغییر سایز
  useEffect(() => {
    if (!isCollapsed) {
      setActiveTooltip(null);
      return;
    }
    const handleDismiss = () => setActiveTooltip(null);
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);
    return () => {
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
    };
  }, [isCollapsed]);

  // پاکسازی تول‌تیپ با تغییر مسیر
  useEffect(() => {
    setActiveTooltip(null);
  }, [path]);

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

  const toggleAnalysisAccordion = useCallback(() => {
    setIsAnalysisExpanded((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("sidebar_analysis_expanded", String(next));
      }
      return next;
    });
  }, []);

  const isLinkActive = useCallback((href: string) => {
    if (href === "/manovrs") {
      return path === href;
    }
    return path === href || (path.startsWith(href) && href !== "/dashboard" && href !== "/depot");
  }, [path]);

  // فیلتر کردن منوهای ناوبری بر اساس مجوزها
  const filteredSections = useMemo(() => {
    const checkPermission = (perm?: string) => {
      if (role === 4) return true; // سوپرادمین به همه جا دسترسی دارد
      if (!perm) return true;
      if (perm === "about.view") return true;
      if (perms.includes(perm)) return true;
      if (perm === "ticket.view") {
        return perms.includes("ticket.view") || perms.includes("ticket.create") || perms.includes("ticket.manage");
      }
      if (perm === "report.build") {
        return perms.includes("report.build") || perms.includes("report.schedule");
      }
      return false;
    };

    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.perm) {
          return checkPermission(item.perm);
        }
        return true;
      }),
    })).filter((section) => section.items.length > 0);
  }, [perms, role]);

  // باز شدن خودکار آکاردئون در صورت تطابق مسیر جاری با هر یک از زیرمنوهای تحلیل و تنظیمات بر اساس الگوی ری‌اکت ۱۹
  const isAnyAnalysisActive = useMemo(() => {
    const analysisSec = filteredSections.find((s) => s.id === "analysis");
    if (!analysisSec) return false;
    return analysisSec.items.some((item) => isLinkActive(item.href));
  }, [filteredSections, isLinkActive]);

  const [prevActivePath, setPrevActivePath] = useState(path);
  if (prevActivePath !== path) {
    setPrevActivePath(path);
    if (isAnyAnalysisActive && !isAnalysisExpanded) {
      setIsAnalysisExpanded(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("sidebar_analysis_expanded", "true");
      }
    }
  }


  return (
    <aside className="sidebar select-none" dir="rtl">
      <div className="brand" style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", width: "100%", justifyContent: isCollapsed ? "center" : "flex-start" }}>
          <div
            className="logo"
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              width: "32px",
              height: "32px",
              borderRadius: "6px",
              overflow: "hidden",
            }}
            onClick={toggleSidebar}
            onMouseEnter={(e) =>
              showTooltip(e, {
                title: branding.title,
                subtitle: "کلیک جهت تغییر وضعیت منو",
                category: "سامانه مانور",
                badge: "پایانه فتح‌آباد",
              })
            }
            onMouseLeave={hideTooltip}
            onFocus={(e) =>
              showTooltip(e, {
                title: branding.title,
                subtitle: "کلیک جهت تغییر وضعیت منو",
                category: "سامانه مانور",
                badge: "پایانه فتح‌آباد",
              })
            }
            onBlur={hideTooltip}
          >
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

        {/* نشانگر وضعیت ارتباط با سرور متمرکز دپو */}
        <div
          style={{ width: "100%", marginTop: "2px", marginBottom: "2px" }}
          onMouseEnter={(e) =>
            showTooltip(e, {
              title: "وضعیت اتصال سرور پایانه",
              category: "شبکه و پایگاه‌داده",
              subtitle: "کلیک جهت ابزار عیب‌یابی و تاخیر شبکه",
              badge: "بررسی زنده",
              badgeVariant: "amber",
            })
          }
          onMouseLeave={hideTooltip}
          onFocus={(e) =>
            showTooltip(e, {
              title: "وضعیت اتصال سرور پایانه",
              category: "شبکه و پایگاه‌داده",
              subtitle: "کلیک جهت ابزار عیب‌یابی و تاخیر شبکه",
              badge: "بررسی زنده",
              badgeVariant: "amber",
            })
          }
          onBlur={hideTooltip}
        >
          <ServerStatusBadge isCollapsed={isCollapsed} />
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
            type="button"
            onClick={toggleSidebar}
            onMouseEnter={(e) =>
              showTooltip(e, {
                title: isCollapsed ? "گسترش منوی ناوبری" : "جمع‌کردن منوی ناوبری",
                category: "ناوبری",
                subtitle: isCollapsed ? "نمایش کامل عناوین و زیرمنوها" : "کوچک‌سازی منو برای فضای بیشتر",
              })
            }
            onMouseLeave={hideTooltip}
            onFocus={(e) =>
              showTooltip(e, {
                title: isCollapsed ? "گسترش منوی ناوبری" : "جمع‌کردن منوی ناوبری",
                category: "ناوبری",
                subtitle: isCollapsed ? "نمایش کامل عناوین و زیرمنوها" : "کوچک‌سازی منو برای فضای بیشتر",
              })
            }
            onBlur={hideTooltip}
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
          >
            {isCollapsed
              ? (navPos === "left" ? <Icons.CaretRight size={16} weight="bold" /> : <Icons.CaretLeft size={16} weight="bold" />)
              : (navPos === "left" ? <Icons.CaretLeft size={16} weight="bold" /> : <Icons.CaretRight size={16} weight="bold" />)}
          </button>
        </div>
      </div>

      <nav className="nav space-y-1">
        {filteredSections.map((section) => {
          // اگر بخش تاشو باشد (تحلیل و تنظیمات)
          if (section.isCollapsible) {
            if (isCollapsed) {
              // در حالت سایدبار جمع‌شده، دکمه آکاردئون به عنوان تاگل آیکون‌ها عمل می‌کند
              return (
                <div key={section.id} className="pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                  <button
                    type="button"
                    onClick={toggleAnalysisAccordion}
                    onMouseEnter={(e) =>
                      showTooltip(e, {
                        title: section.title,
                        category: "مدیریت و تنظیمات",
                        subtitle: isAnalysisExpanded ? "کلیک جهت بستن زیرمنوها" : "کلیک جهت نمایش زیرمنوها",
                        badge: `${section.items.length} زیرمنو`,
                        isActive: isAnyAnalysisActive,
                      })
                    }
                    onMouseLeave={hideTooltip}
                    onFocus={(e) =>
                      showTooltip(e, {
                        title: section.title,
                        category: "مدیریت و تنظیمات",
                        subtitle: isAnalysisExpanded ? "کلیک جهت بستن زیرمنوها" : "کلیک جهت نمایش زیرمنوها",
                        badge: `${section.items.length} زیرمنو`,
                        isActive: isAnyAnalysisActive,
                      })
                    }
                    onBlur={hideTooltip}
                    className={`w-11 h-11 mx-auto rounded-full flex items-center justify-center transition-all relative ${
                      isAnyAnalysisActive
                        ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/40"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icons.Settings size={20} weight={isAnyAnalysisActive ? "bold" : "regular"} />
                    {isAnyAnalysisActive && (
                      <span className="absolute top-1 left-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
                    )}
                  </button>

                  {/* نمایش آیکون‌های داخلی در حالت باز بودن آکاردئون در نوار کوچک */}
                  <AnimatePresence initial={false}>
                    {isAnalysisExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-1 pt-1 overflow-hidden flex flex-col items-center"
                      >
                        {section.items.map((n) => {
                          const IconComponent = Icons[n.icKey as keyof typeof Icons];
                          const active = isLinkActive(n.href);
                          return (
                            <Link
                              key={n.href}
                              href={n.href}
                              className={active ? "active" : ""}
                              onClick={hideTooltip}
                              onMouseEnter={(e) =>
                                showTooltip(e, {
                                  title: n.label,
                                  category: section.title,
                                  isActive: active,
                                })
                              }
                              onMouseLeave={hideTooltip}
                              onFocus={(e) =>
                                showTooltip(e, {
                                  title: n.label,
                                  category: section.title,
                                  isActive: active,
                                })
                              }
                              onBlur={hideTooltip}
                            >
                              <span className="ic">
                                {IconComponent && <IconComponent size={18} weight={active ? "bold" : "regular"} />}
                              </span>
                            </Link>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            // حالت عادی سایدبار باز (Full Expanded Sidebar): آکاردئون انیمیشنی پیشرفته
            return (
              <div key={section.id} className="pt-2">
                {/* هدر تعاملی آکاردئون همراه با آیکون چرخ‌دنده، برچسب، نشان تعداد و چوران چرخشی */}
                <button
                  type="button"
                  onClick={toggleAnalysisAccordion}
                  aria-expanded={isAnalysisExpanded}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all group ${
                    isAnyAnalysisActive
                      ? "text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
                  }`}
                  style={{ cursor: "pointer" }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`transition-transform duration-200 ${isAnalysisExpanded ? "rotate-90 text-amber-600" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"}`}>
                      <Icons.Settings size={16} weight={isAnyAnalysisActive ? "bold" : "regular"} />
                    </span>
                    <span className="truncate tracking-tight font-black">{section.title}</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                      {section.items.length}
                    </span>
                    {isAnyAnalysisActive && !isAnalysisExpanded && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="زیرمنوی فعال" />
                    )}
                  </div>

                  <span
                    className="shrink-0 transition-transform duration-300 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200"
                    style={{
                      transform: isAnalysisExpanded ? "rotate(0deg)" : "rotate(180deg)",
                    }}
                  >
                    <Icons.CaretDown size={14} weight="bold" />
                  </span>
                </button>

                {/* محتوای دراپ‌داون آکاردئون با انیمیشن روان ارتفاع و فید */}
                <AnimatePresence initial={false}>
                  {isAnalysisExpanded && (
                    <motion.div
                      key="analysis-accordion-body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                      style={{ overflow: "hidden" }}
                      className="ps-2 pe-1 pt-1 space-y-0.5 border-s-2 border-slate-200/60 dark:border-slate-800/80 ms-4 mt-1"
                    >
                      {section.items.map((n, idx) => {
                        const IconComponent = Icons[n.icKey as keyof typeof Icons];
                        const active = isLinkActive(n.href);

                        return (
                          <motion.div
                            key={n.href}
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2, delay: idx * 0.015 }}
                          >
                            <Link
                              href={n.href}
                              className={active ? "active" : ""}
                              style={{
                                padding: "8px 12px",
                                fontSize: "13px",
                              }}
                            >
                              <span className="ic">
                                {IconComponent && <IconComponent size={16} weight={active ? "bold" : "regular"} />}
                              </span>
                              <span>{n.label}</span>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          // بخش‌های غیراکاردئونی (عملیات پایانه و اطلاعات پایه)
          return (
            <div key={section.id} className="space-y-1">
              {!isCollapsed && (
                <div className="grp">
                  {section.title}
                </div>
              )}

              {section.items.map((n, i) => {
                const IconComponent = Icons[n.icKey as keyof typeof Icons];
                const active = isLinkActive(n.href);

                return (
                  <motion.div
                    key={n.href}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.02, ease: [0.32, 0.72, 0, 1] }}
                  >
                    <Link
                      href={n.href}
                      className={active ? "active" : ""}
                      onClick={hideTooltip}
                      onMouseEnter={(e) =>
                        showTooltip(e, {
                          title: n.label,
                          category: section.title,
                          isActive: active,
                        })
                      }
                      onMouseLeave={hideTooltip}
                      onFocus={(e) =>
                        showTooltip(e, {
                          title: n.label,
                          category: section.title,
                          isActive: active,
                        })
                      }
                      onBlur={hideTooltip}
                    >
                      <span className="ic">
                        {IconComponent && <IconComponent size={18} weight={active ? "bold" : "regular"} />}
                      </span>
                      {!isCollapsed && <span>{n.label}</span>}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="side-foot">
        {!isCollapsed && <div className="who">{fullName || "کاربر"}</div>}
        {!isCollapsed && <div className="role">{roleName || Role[role] || "—"}</div>}
        <form action={logoutAction} style={{ marginTop: isCollapsed ? 0 : 12 }}>
          <button
            type="submit"
            className="btn sm primary"
            style={{
              width: isCollapsed ? "40px" : "100%",
              height: isCollapsed ? "40px" : "auto",
              borderRadius: isCollapsed ? "50%" : "var(--r-sm)",
              justifyContent: "center",
              padding: isCollapsed ? "0" : "8px 12px",
            }}
            onClick={hideTooltip}
            onMouseEnter={(e) =>
              showTooltip(e, {
                title: "خروج از سامانه",
                category: "امنیت حساب",
                subtitle: `خروج کاربر ${fullName || ""}`,
                badge: "پایان نشست",
                badgeVariant: "warning",
              })
            }
            onMouseLeave={hideTooltip}
            onFocus={(e) =>
              showTooltip(e, {
                title: "خروج از سامانه",
                category: "امنیت حساب",
                subtitle: `خروج کاربر ${fullName || ""}`,
                badge: "پایان نشست",
                badgeVariant: "warning",
              })
            }
            onBlur={hideTooltip}
          >
            <Icons.Logout size={14} weight="bold" style={{ marginInlineEnd: isCollapsed ? 0 : 4 }} />
            {!isCollapsed && <span>خروج</span>}
          </button>
        </form>

        <div
          style={{
            marginTop: "16px",
            borderTop: "1px dashed var(--line-soft)",
            paddingTop: "10px",
            textAlign: "center",
            fontSize: "10px",
            color: "var(--ink-faint)",
            direction: "rtl",
          }}
        >
          <Link
            href="/about"
            style={{
              textDecoration: "none",
              color: "inherit",
              display: "block",
              borderRadius: "6px",
              padding: "4px",
              transition: "background-color 0.2s, color 0.2s",
            }}
            onClick={hideTooltip}
            onMouseEnter={(e) =>
              showTooltip(e, {
                title: `سامانه مانور دپو · نسخه ${APP_CURRENT_VERSION}`,
                category: "شناسنامه سیستم",
                subtitle: `${APP_BUILD_DATE_JALALI} · توسعه: سید شبیر موسوی`,
                badge: "درباره ما",
              })
            }
            onMouseLeave={hideTooltip}
            onFocus={(e) =>
              showTooltip(e, {
                title: `سامانه مانور دپو · نسخه ${APP_CURRENT_VERSION}`,
                category: "شناسنامه سیستم",
                subtitle: `${APP_BUILD_DATE_JALALI} · توسعه: سید شبیر موسوی`,
                badge: "درباره ما",
              })
            }
            onBlur={hideTooltip}
          >
            {isCollapsed ? (
              <span>v{APP_CURRENT_VERSION}</span>
            ) : (
              <div>
                <span style={{ fontWeight: 600 }}>سامانه مانور دپو · نسخه {APP_CURRENT_VERSION}</span>
                <div style={{ marginTop: "2px", fontSize: "9.5px", color: "var(--ink-faint)" }}>{APP_BUILD_DATE_JALALI} · توسعه توسط سید شبیر موسوی</div>
              </div>
            )}
          </Link>
        </div>
      </div>

      {isCollapsed && (
        <SidebarFlyoutTooltip item={activeTooltip} navPos={navPos as "right" | "left"} />
      )}
    </aside>
  );
}
