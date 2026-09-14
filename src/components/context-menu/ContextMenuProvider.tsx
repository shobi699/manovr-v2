"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ContextMenuContext } from "./ContextMenuContext";
import ContextMenuUI from "./ContextMenuUI";
import { ContextMenuGroup, ContextMenuItem, ContextMenuPosition } from "./types";
import { useToast } from "@/components/ui/Toast";

interface ContextMenuProviderProps {
  children: React.ReactNode;
}

export function ContextMenuProvider({ children }: ContextMenuProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<ContextMenuPosition>({ x: 0, y: 0 });
  const [customItems, setCustomItems] = useState<ContextMenuItem[] | null>(null);
  const [registeredGroups, setRegisteredGroups] = useState<Record<string, ContextMenuItem[]>>({});

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setCustomItems(null);
  }, []);

  const openMenu = useCallback((e: React.MouseEvent | MouseEvent, items?: ContextMenuItem[]) => {
    e.preventDefault();
    if ("nativeEvent" in e && e.nativeEvent) {
      e.nativeEvent.preventDefault();
      (e.nativeEvent as any).__contextMenuHandled = true;
    } else {
      (e as any).__contextMenuHandled = true;
    }
    setPosition({ x: e.clientX, y: e.clientY });
    if (items && items.length > 0) {
      setCustomItems(items);
    } else {
      setCustomItems(null);
    }
    setIsOpen(true);
  }, []);

  const registerItems = useCallback((key: string, items: ContextMenuItem[]) => {
    setRegisteredGroups((prev) => ({
      ...prev,
      [key]: items,
    }));

    return () => {
      setRegisteredGroups((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };
  }, []);

  // شنونده رویدادهای سراسری: بستن با اسکرول یا کلید Esc
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
      }
    };

    const handleScroll = () => {
      closeMenu();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, [isOpen, closeMenu]);

  // شنود رویداد کلیک راست (contextmenu) در سطح برنامه با حفظ تعامل درگ-اند-دراپ
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // اگر رویداد قبلاً توسط کامپوننت فرزند مدیریت و کنسل شده باشد
      if (e.defaultPrevented || (e as any).__contextMenuHandled) {
        return;
      }

      // اگر کاربر روی المان‌های متنی (input, textarea) کلیک کرده باشد، منوی بومی مرورگر حفظ شود
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest("input") ||
          target.closest("textarea") ||
          target.getAttribute("data-native-context") === "true")
      ) {
        return;
      }

      // رهگیری و باز کردن منوی هوشمند با موقعیت کلیک
      e.preventDefault();
      setPosition({ x: e.clientX, y: e.clientY });
      setCustomItems(null);
      setIsOpen(true);
    };

    window.addEventListener("contextmenu", handleContextMenu);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  // بستن منو هنگام تغییر مسیر صفحه بر اساس الگوی رسمی ری‌اکت ۱۹
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (isOpen) {
      setIsOpen(false);
      setCustomItems(null);
    }
  }


  // ساخت منوهای پیش‌فرض سراسری (Global Shortcuts)
  const globalNavigationItems = useMemo<ContextMenuItem[]>(() => {
    return [
      {
        id: "nav-depot",
        label: "نمای تعاملی پایانه دپو",
        icon: <span>🚇</span>,
        shortcut: "Alt+1",
        disabled: pathname === "/depot",
        badge: pathname === "/depot" ? "صفحه جاری" : undefined,
        onClick: () => router.push("/depot"),
      },
      {
        id: "nav-dashboard",
        label: "داشبورد و آمار مانورها",
        icon: <span>📊</span>,
        shortcut: "Alt+2",
        disabled: pathname === "/dashboard",
        badge: pathname === "/dashboard" ? "صفحه جاری" : undefined,
        onClick: () => router.push("/dashboard"),
      },
      {
        id: "nav-manovr-new",
        label: "ثبت سریع مانور جدید",
        icon: <span>➕</span>,
        shortcut: "Ctrl+N",
        onClick: () => router.push("/manovrs/new"),
      },
      {
        id: "nav-phonebook",
        label: "دفتر تلفن پرسنل",
        icon: <span>📖</span>,
        shortcut: "Alt+P",
        onClick: () => router.push("/phonebook"),
      },
      {
        id: "sys-copy-url",
        label: "کپی نشانی صفحه جاری",
        icon: <span>📋</span>,
        separatorAfter: true,
        onClick: () => {
          if (typeof window !== "undefined") {
            navigator.clipboard.writeText(window.location.href);
            toast.success("نشانی صفحه جاری با موفقیت در حافظه کپی شد.");
          }
        },
      },
      {
        id: "sys-reload",
        label: "بروزرسانی زنده صفحه",
        icon: <span>🔄</span>,
        shortcut: "F5",
        onClick: () => {
          router.refresh();
          toast.info("اطلاعات صفحه با موفقیت به‌روز شد.");
        },
      },
    ];
  }, [pathname, router, toast]);

  // ترکیب گروه‌های ابزاری فعال
  const menuGroups = useMemo<ContextMenuGroup[]>(() => {
    const groups: ContextMenuGroup[] = [];

    // اگر منوی سفارشی درجا پاس داده شده باشد
    if (customItems && customItems.length > 0) {
      groups.push({
        id: "custom-context",
        title: "ابزارهای آیتم انتخاب‌شده",
        icon: <span>⚡</span>,
        items: customItems,
      });
      return groups;
    }

    // ابزارهای تزریق‌شده از صفحات (مانند ابزارهای پایانه دپو) در اولویت بالا
    Object.entries(registeredGroups).forEach(([key, items]) => {
      if (items && items.length > 0) {
        let title = "ابزارهای اختصاصی صفحه";
        let icon = <span>🛠️</span>;
        if (key === "depot_tools" || key.includes("depot")) {
          title = "ابزارهای تعاملی پایانه دپو";
          icon = <span>🚆</span>;
        }

        groups.push({
          id: key,
          title,
          icon,
          items,
        });
      }
    });

    // میانبرهای سراسری و ناوبری
    groups.push({
      id: "global-nav",
      title: "دسترسی سریع سامانه",
      icon: <span>🧭</span>,
      items: globalNavigationItems,
    });

    return groups;
  }, [customItems, registeredGroups, globalNavigationItems]);

  const value = useMemo(
    () => ({
      isOpen,
      position,
      customItems,
      openMenu,
      closeMenu,
      registerItems,
      registeredGroups,
    }),
    [isOpen, position, customItems, openMenu, closeMenu, registerItems, registeredGroups]
  );

  return (
    <ContextMenuContext.Provider value={value}>
      {children}
      <ContextMenuUI
        isOpen={isOpen}
        position={position}
        groups={menuGroups}
        onClose={closeMenu}
      />
    </ContextMenuContext.Provider>
  );
}
