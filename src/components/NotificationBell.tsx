"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/app/actions/notification";

interface Notification {
  id: number;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationBell({ userId }: { userId: number }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "unread">("all");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // واکشی اعلان‌ها در لود اولیه
  const fetchNotifs = async () => {
    const res = await getNotifications();
    if (res.ok && res.data) {
      setNotifications(res.data as any[]);
      setUnreadCount(res.unreadCount || 0);
    }
  };

  useEffect(() => {
    fetchNotifs();

    // ثبت‌نام در رویدادهای زنده SSE
    const eventSource = new EventSource("/api/events");
    
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload && payload.channel === `notification:${userId}`) {
          const newNotif = payload.data.notification;
          setNotifications((prev) => [newNotif, ...prev].slice(0, 20));
          setUnreadCount((c) => c + 1);
          // پخش صدای کوچک نوتیفیکیشن در صورت پشتیبانی مرورگر
          try {
            const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==\n");
            audio.play();
          } catch {}
        }
      } catch {}
    };

    // بستن در صورت کلیک خارج از کامپوننت
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      eventSource.close();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userId]);

  const handleMarkAsRead = async (id: number) => {
    const res = await markNotificationAsRead(id);
    if (res.ok) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  };

  const handleMarkAllRead = async () => {
    const res = await markAllNotificationsAsRead();
    if (res.ok) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "لحظاتی پیش";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} دقیقه پیش`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ساعت پیش`;
    const days = Math.floor(hours / 24);
    return `${days} روز پیش`;
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* دکمه زنگوله */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: "none",
          border: "none",
          fontSize: "20px",
          cursor: "pointer",
          position: "relative",
          padding: "6px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink)",
          transition: "background 0.2s",
        }}
        className="btn-hover-gray"
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "2px",
              right: "2px",
              backgroundColor: "var(--crit)",
              color: "#fff",
              borderRadius: "50%",
              width: "16px",
              height: "16px",
              fontSize: "10px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 2px var(--ground)",
            }}
            className="animate-pulse"
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* منوی کشویی اعلان‌ها */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "40px",
            right: "0",
            left: "auto",
            width: "340px",
            backgroundColor: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "12px",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
            zIndex: 1001,
            maxHeight: "450px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            backdropFilter: "blur(8px)",
          }}
        >
          {/* هدر باکس اعلان */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: "rgba(30,41,59,0.03)",
            }}
          >
            <b style={{ fontSize: "13px" }}>اعلان‌های سیستم</b>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent)",
                  fontSize: "11px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                خوانده شدن همه
              </button>
            )}
          </div>

          {/* تب‌های فیلتر */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--line-soft)",
              backgroundColor: "rgba(30,41,59,0.01)",
              padding: "0 8px",
            }}
          >
            <button
              onClick={() => setActiveFilter("all")}
              style={{
                flex: 1,
                padding: "10px 0",
                background: "none",
                border: "none",
                borderBottom: activeFilter === "all" ? "2px solid var(--accent)" : "2px solid transparent",
                fontSize: "12px",
                fontWeight: activeFilter === "all" ? "bold" : "normal",
                color: activeFilter === "all" ? "var(--accent)" : "var(--ink-soft)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              همه ({notifications.length})
            </button>
            <button
              onClick={() => setActiveFilter("unread")}
              style={{
                flex: 1,
                padding: "10px 0",
                background: "none",
                border: "none",
                borderBottom: activeFilter === "unread" ? "2px solid var(--accent)" : "2px solid transparent",
                fontSize: "12px",
                fontWeight: activeFilter === "unread" ? "bold" : "normal",
                color: activeFilter === "unread" ? "var(--accent)" : "var(--ink-soft)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              خوانده نشده ({unreadCount})
            </button>
          </div>

          {/* لیست اعلان‌ها */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifications.filter((n) => activeFilter === "all" || !n.readAt).length === 0 ? (
              <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--ink-soft)" }}>
                <span style={{ fontSize: "28px" }}>📭</span>
                <p style={{ marginTop: "8px", fontSize: "12px" }}>اعلانی در این بخش ندارید.</p>
              </div>
            ) : (
              notifications
                .filter((n) => activeFilter === "all" || !n.readAt)
                .map((n, index) => {
                  const isUnread = !n.readAt;
                  return (
                    <div
                      key={`${n.id || "notif"}-${index}`}
                      style={{
                        padding: "14px 16px",
                        borderBottom: "1px solid var(--line-soft)",
                        backgroundColor: isUnread ? "rgba(216, 132, 42, 0.04)" : "transparent",
                        borderRight: isUnread ? "3px solid var(--accent)" : "3px solid transparent",
                        transition: "all 0.2s",
                        position: "relative",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "8px" }}>
                        <div style={{ display: "flex", gap: "8px", alignItems: "start" }}>
                          <span style={{ fontSize: "14px", marginTop: "1px" }}>
                            {n.kind === "success" ? "🟢" : n.kind === "alert" ? "🚨" : "ℹ️"}
                          </span>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span
                              style={{
                                fontWeight: isUnread ? "bold" : "600",
                                fontSize: "12px",
                                color: "var(--ink)",
                              }}
                            >
                              {n.title}
                            </span>
                            <span style={{ fontSize: "10px", color: "var(--ink-faint)", marginTop: "2px" }}>
                              {formatTimeAgo(n.createdAt)}
                            </span>
                          </div>
                        </div>
                        {isUnread && (
                          <button
                            onClick={() => handleMarkAsRead(n.id)}
                            style={{
                              background: "var(--ground)",
                              border: "1px solid var(--line)",
                              borderRadius: "50%",
                              width: "20px",
                              height: "20px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--accent)",
                              fontSize: "10px",
                              cursor: "pointer",
                              transition: "all 0.2s",
                            }}
                            title="علامت‌گذاری به عنوان خوانده شده"
                          >
                            ✓
                          </button>
                        )}
                      </div>
                      <p style={{ margin: "6px 0 0 0", fontSize: "11.5px", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                        {n.body}
                      </p>
                      {n.link && (
                        <Link
                          href={n.link}
                          onClick={() => {
                            setIsOpen(false);
                            if (isUnread) handleMarkAsRead(n.id);
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            marginTop: "8px",
                            fontSize: "10.5px",
                            color: "var(--accent)",
                            fontWeight: "bold",
                            textDecoration: "none",
                          }}
                        >
                          مشاهده جزئیات ➔
                        </Link>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
