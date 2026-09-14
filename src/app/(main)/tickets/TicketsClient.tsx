"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  createTicket,
  replyToTicket,
  updateTicketStatus,
  reassignTicket,
  getActivePersonnel,
} from "@/app/actions/tickets";
import { useToast } from "@/components/ui/Toast";
import { persianSearchMatch } from "@/lib/persian-text";

interface TicketReply {
  id: number;
  ticketId: number;
  body: string;
  userId: number;
  createdAt: Date | string;
}

interface TicketHistoryRecord {
  id: number;
  ticketId: number;
  fromUserId: number | null;
  toUserId: number | null;
  action: string;
  note: string | null;
  createdAt: Date | string;
  fromUser?: { id: number; firstName: string; lastName: string } | null;
  toUser?: { id: number; firstName: string; lastName: string } | null;
}

interface TicketRecord {
  id: number;
  title: string;
  body: string;
  status: "open" | "resolved" | "closed" | string;
  creatorId: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  creator: {
    id: number;
    firstName: string;
    lastName: string;
    avatarColor?: string | null;
  };
  assignee?: {
    id: number;
    firstName: string;
    lastName: string;
    avatarColor?: string | null;
  } | null;
  replies: TicketReply[];
  history: TicketHistoryRecord[];
}

interface CurrentUser {
  id: number;
  fullName: string;
  role: number;
}

export default function TicketsClient({
  initialTickets,
  currentUser,
}: {
  initialTickets: TicketRecord[];
  currentUser: CurrentUser;
}) {
  const [tickets, setTickets] = useState<TicketRecord[]>(initialTickets);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(
    initialTickets.length > 0 ? initialTickets[0].id : null
  );

  // لیست پرسنل جهت انتساب و ارجاع
  const [personnel, setPersonnel] = useState<any[]>([]);

  // فیلترها و جستجو
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "open" | "resolved" | "closed">("all");

  // فرم ثبت تیکت جدید
  const [newTicketTitle, setNewTicketTitle] = useState("");
  const [newTicketBody, setNewTicketBody] = useState("");
  const [newTicketAssignee, setNewTicketAssignee] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // فرم ارجاع تیکت
  const [isForwardOpen, setIsForwardOpen] = useState(false);
  const [forwardTargetId, setForwardTargetId] = useState<string>("");
  const [forwardNote, setForwardNote] = useState("");

  const [replyBody, setReplyBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const activeTicket = tickets.find((t) => t.id === selectedTicketId);

  // بارگذاری پرسنل در زمان لود کامپوننت
  useEffect(() => {
    async function fetchPersonnel() {
      const res = await getActivePersonnel();
      if (res.ok && res.data) {
        setPersonnel(res.data);
      }
    }
    fetchPersonnel();
  }, []);

  // فرمت تاریخ جلالی
  const formatDate = (dateStr: Date | string) => {
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

  // فیلتر کردن لیست تیکت‌ها بر اساس تب و متن جستجو با پشتیبانی کامل از حروف فارسی و عربی
  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      !searchQuery.trim() ||
      persianSearchMatch(t.title, searchQuery) ||
      persianSearchMatch(String(t.id), searchQuery) ||
      persianSearchMatch(`${t.creator.firstName} ${t.creator.lastName}`, searchQuery) ||
      (t.assignee && persianSearchMatch(`${t.assignee.firstName} ${t.assignee.lastName}`, searchQuery));

    if (activeTab === "all") return matchesSearch;
    return t.status === activeTab && matchesSearch;
  });

  // ثبت تیکت جدید
  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketTitle.trim() || !newTicketBody.trim()) {
      toast.warning("لطفاً عنوان و شرح تیکت را وارد کنید.");
      return;
    }

    const assigneeVal = newTicketAssignee ? Number(newTicketAssignee) : null;

    startTransition(async () => {
      const res = await createTicket(newTicketTitle, newTicketBody, assigneeVal);
      if (res.ok && res.data) {
        toast.success("تیکت جدید با موفقیت ثبت شد.");
        
        // انتساب‌شونده در صورت وجود
        const assigneeUser = assigneeVal
          ? personnel.find((p) => p.id === assigneeVal)
          : null;

        const newTicket: TicketRecord = {
          ...res.data,
          creator: {
            id: currentUser.id,
            firstName: currentUser.fullName.split(" ")[0] || "کاربر",
            lastName: currentUser.fullName.split(" ")[1] || "سیستم",
          },
          assignee: assigneeUser
            ? {
                id: assigneeUser.id,
                firstName: assigneeUser.firstName,
                lastName: assigneeUser.lastName,
              }
            : null,
          replies: [],
          history: [
            {
              id: Date.now(),
              ticketId: res.data.id,
              fromUserId: currentUser.id,
              toUserId: assigneeVal,
              action: "CREATE",
              note: "ثبت اولیه تیکت در کارتابل",
              createdAt: new Date(),
              fromUser: {
                id: currentUser.id,
                firstName: currentUser.fullName.split(" ")[0] || "کاربر",
                lastName: currentUser.fullName.split(" ")[1] || "سیستم",
              },
              toUser: assigneeUser
                ? {
                    id: assigneeUser.id,
                    firstName: assigneeUser.firstName,
                    lastName: assigneeUser.lastName,
                  }
                : null,
            },
          ],
        };
        setTickets([newTicket, ...tickets]);
        setSelectedTicketId(newTicket.id);
        setNewTicketTitle("");
        setNewTicketBody("");
        setNewTicketAssignee("");
        setIsCreateOpen(false);
      } else {
        toast.error(res.error || "خطا در ثبت تیکت");
      }
    });
  };

  // ارجاع تیکت به همکار دیگر
  const handleForwardTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !forwardTargetId) {
      toast.warning("لطفاً همکار مورد نظر را برای ارجاع تیکت انتخاب کنید.");
      return;
    }

    const targetUserId = Number(forwardTargetId);

    startTransition(async () => {
      const res = await reassignTicket(selectedTicketId, targetUserId, forwardNote);
      if (res.ok && res.data) {
        toast.success("تیکت با موفقیت ارجاع شد.");

        const targetUser = personnel.find((p) => p.id === targetUserId);
        
        // بروزرسانی لوکال لیست تیکت‌ها
        setTickets((prev) =>
          prev.map((t) => {
            if (t.id === selectedTicketId) {
              const newHistory: TicketHistoryRecord = {
                id: Date.now(),
                ticketId: selectedTicketId,
                fromUserId: currentUser.id,
                toUserId: targetUserId,
                action: "REASSIGN",
                note: forwardNote || "ارجاع تیکت به همکار دیگر",
                createdAt: new Date().toISOString(),
                fromUser: {
                  id: currentUser.id,
                  firstName: currentUser.fullName.split(" ")[0] || "کاربر",
                  lastName: currentUser.fullName.split(" ")[1] || "سیستم",
                },
                toUser: targetUser
                  ? {
                      id: targetUser.id,
                      firstName: targetUser.firstName,
                      lastName: targetUser.lastName,
                    }
                  : null,
              };

              return {
                ...t,
                assigneeId: targetUserId,
                assignee: targetUser
                  ? {
                      id: targetUser.id,
                      firstName: targetUser.firstName,
                      lastName: targetUser.lastName,
                    }
                  : null,
                history: [...t.history, newHistory],
              };
            }
            return t;
          })
        );

        setForwardTargetId("");
        setForwardNote("");
        setIsForwardOpen(false);
      } else {
        toast.error(res.error || "خطا در ارجاع تیکت");
      }
    });
  };

  // ارسال پاسخ جدید
  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !replyBody.trim()) return;

    startTransition(async () => {
      const res = await replyToTicket(selectedTicketId, replyBody);
      if (res.ok && res.data) {
        const updatedReplies = [...(activeTicket?.replies || []), res.data];
        
        // ثبت در هیستوری محلی
        const replyHistory: TicketHistoryRecord = {
          id: Date.now(),
          ticketId: selectedTicketId,
          fromUserId: currentUser.id,
          toUserId: null,
          action: "REPLY",
          note: "ثبت پاسخ جدید در گفتگو",
          createdAt: new Date().toISOString(),
          fromUser: {
            id: currentUser.id,
            firstName: currentUser.fullName.split(" ")[0] || "کاربر",
            lastName: currentUser.fullName.split(" ")[1] || "سیستم",
          },
        };

        setTickets((prev) =>
          prev.map((t) =>
            t.id === selectedTicketId
              ? {
                  ...t,
                  replies: updatedReplies,
                  status: "open",
                  history: [...t.history, replyHistory],
                }
              : t
          )
        );
        setReplyBody("");
        toast.success("پاسخ با موفقیت ارسال شد.");
      } else {
        toast.error(res.error || "خطا در ارسال پاسخ");
      }
    });
  };

  // تغییر وضعیت تیکت
  const handleUpdateStatus = (status: "resolved" | "closed" | "open") => {
    if (!selectedTicketId) return;

    startTransition(async () => {
      const res = await updateTicketStatus(selectedTicketId, status);
      if (res.ok) {
        const statusText = status === "resolved" ? "حل شده" : status === "closed" ? "بسته شده" : "بازگشایی مجدد";
        const statusHistory: TicketHistoryRecord = {
          id: Date.now(),
          ticketId: selectedTicketId,
          fromUserId: currentUser.id,
          toUserId: null,
          action: "STATUS_CHANGE",
          note: `تغییر وضعیت تیکت به: ${statusText}`,
          createdAt: new Date().toISOString(),
          fromUser: {
            id: currentUser.id,
            firstName: currentUser.fullName.split(" ")[0] || "کاربر",
            lastName: currentUser.fullName.split(" ")[1] || "سیستم",
          },
        };

        setTickets((prev) =>
          prev.map((t) =>
            t.id === selectedTicketId
              ? { ...t, status, history: [...t.history, statusHistory] }
              : t
          )
        );
        toast.success(`وضعیت تیکت به "${statusText}" تغییر یافت.`);
      } else {
        toast.error(res.error || "خطا در تغییر وضعیت تیکت");
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* دکمه‌های ثبت تیکت جدید و توضیحات */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-soft)" }}>
          سامانه کارتابل و ارجاع تیکت‌های پشتیبانی. شما می‌توانید تیکت‌ها را بین پرسنل ارجاع دهید و گردش کار آن را پیگیری کنید.
        </p>
        <button
          onClick={() => setIsCreateOpen(!isCreateOpen)}
          className="btn primary"
          style={{ gap: "6px" }}
        >
          {isCreateOpen ? "❌ انصراف" : "➕ ثبت تیکت در کارتابل"}
        </button>
      </div>

      {/* فرم ثبت تیکت جدید */}
      {isCreateOpen && (
        <div className="card" style={{ padding: "20px", animation: "slideDown 0.2s ease-out" }}>
          <div className="card-head" style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--line)" }}>
            <h2>📝 ثبت تیکت پشتیبانی جدید</h2>
          </div>
          <form onSubmit={handleCreateTicket} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
            
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="ticketTitle" style={{ fontSize: "13px", fontWeight: 650 }}>عنوان موضوع تیکت:</label>
                <input
                  type="text"
                  id="ticketTitle"
                  value={newTicketTitle}
                  onChange={(e) => setNewTicketTitle(e.target.value)}
                  placeholder="عنوان کوتاه موضوع یا مشکل فنی..."
                  style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)" }}
                  required
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="ticketAssignee" style={{ fontSize: "13px", fontWeight: 650 }}>ارجاع مستقیم به همکار (اختیاری):</label>
                <select
                  id="ticketAssignee"
                  value={newTicketAssignee}
                  onChange={(e) => setNewTicketAssignee(e.target.value)}
                  style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)" }}
                >
                  <option value="">-- بدون انتساب (عمومی) --</option>
                  {personnel
                    .filter((p) => p.id !== currentUser.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="ticketBody" style={{ fontSize: "13px", fontWeight: 650 }}>شرح جزئیات تیکت:</label>
              <textarea
                id="ticketBody"
                rows={4}
                value={newTicketBody}
                onChange={(e) => setNewTicketBody(e.target.value)}
                placeholder="جزئیات دقیق را به همراه کد قطار، خط ریل یا اشکال سیستم بنویسید..."
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)", fontFamily: "inherit", resize: "vertical" }}
                required
              />
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="btn"
                style={{ border: "1px solid var(--line)" }}
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="btn primary"
              >
                {isPending ? "در حال ثبت..." : "💾 ایجاد تیکت"}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* تب‌ها و کادر جستجو */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        
        {/* تب‌ها */}
        <div style={{ display: "flex", gap: "8px", borderBottom: "2px solid var(--line)", paddingBottom: "2px", flex: 1 }}>
          {(["all", "open", "resolved", "closed"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 16px",
                border: "none",
                background: "transparent",
                borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                color: activeTab === tab ? "var(--ink)" : "var(--ink-soft)",
                fontWeight: activeTab === tab ? "bold" : "normal",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {tab === "all" ? "کل تیکت‌ها" : tab === "open" ? "تیکت‌های باز 🟢" : tab === "resolved" ? "حل شده ✅" : "بسته شده 🔒"}
            </button>
          ))}
        </div>

        {/* کادر جستجو */}
        <div style={{ width: "300px" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی تیکت با عنوان، شناسه یا فرستنده..."
            style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)" }}
          />
        </div>

      </div>

      {/* بدنه کارتابل: لیست تیکت‌ها و پنل جزئیات */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2.5fr", gap: "24px" }} className="tickets-grid">
        
        {/* لیست تیکت‌ها */}
        <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", maxHeight: "650px", overflowY: "auto" }}>
          <div className="card-head" style={{ padding: "0 0 10px 0", borderBottom: "1px solid var(--line)" }}>
            <h2>تیکت‌های کارتابل ({filteredTickets.length})</h2>
          </div>

          {filteredTickets.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--ink-soft)" }}>
              <span style={{ fontSize: "32px" }}>📬</span>
              <p style={{ marginTop: "8px", fontSize: "13px" }}>تیکتی یافت نشد.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filteredTickets.map((t) => {
                const isActive = t.id === selectedTicketId;
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedTicketId(t.id);
                      setIsForwardOpen(false);
                    }}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      border: isActive ? "1px solid var(--accent)" : "1px solid var(--line-soft)",
                      background: isActive ? "var(--accent-soft)" : "rgba(30,41,59,0.01)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: "var(--ink-faint)", fontFamily: "var(--mono)" }}>
                        #{t.id}
                      </span>
                      {t.status === "open" ? (
                        <span className="pill p-info" style={{ fontSize: "9.5px", padding: "2px 6px" }}>باز</span>
                      ) : t.status === "resolved" ? (
                        <span className="pill p-good" style={{ fontSize: "9.5px", padding: "2px 6px" }}>حل شده</span>
                      ) : (
                        <span className="pill p-mut" style={{ fontSize: "9.5px", padding: "2px 6px" }}>بسته</span>
                      )}
                    </div>
                    <h3 style={{ margin: 0, fontSize: "13.5px", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.title}
                    </h3>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10.5px", color: "var(--ink-soft)" }}>
                      <span>فرستنده: {t.creator.firstName} {t.creator.lastName}</span>
                      <span>{formatDate(t.createdAt).split(" ")[0]}</span>
                    </div>
                    {t.assignee && (
                      <div style={{ fontSize: "10.5px", color: "var(--accent)", borderTop: "1px dashed var(--line)", paddingTop: "4px", marginTop: "2px" }}>
                        👤 در دست اقدام: {t.assignee.firstName} {t.assignee.lastName}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* جزئیات تیکت و تاریخچه گردش کار */}
        <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", minHeight: "550px" }}>
          {activeTicket ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "16px" }}>
              
              {/* هدر تیکت فعال */}
              <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--ink-faint)", fontFamily: "var(--mono)" }}>تیکت شناسه #{activeTicket.id}</span>
                    <h2 style={{ fontSize: "18px", fontWeight: "bold", margin: "4px 0 0 0" }}>{activeTicket.title}</h2>
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    
                    {/* دکمه ارجاع تیکت */}
                    {activeTicket.status !== "closed" && (
                      <button
                        onClick={() => setIsForwardOpen(!isForwardOpen)}
                        className="btn sm"
                        style={{ border: "1px solid var(--accent)", color: "var(--accent)", padding: "4px 10px", fontSize: "11px" }}
                      >
                        🔗 ارجاع تیکت (Forward)
                      </button>
                    )}

                    {activeTicket.status !== "resolved" && (
                      <button
                        onClick={() => handleUpdateStatus("resolved")}
                        className="btn sm"
                        style={{ border: "1px solid var(--good)", color: "var(--good)", padding: "4px 10px", fontSize: "11px" }}
                      >
                        ✔ حل شد
                      </button>
                    )}
                    {activeTicket.status !== "closed" && (
                      <button
                        onClick={() => handleUpdateStatus("closed")}
                        className="btn sm"
                        style={{ border: "1px solid var(--ink-soft)", color: "var(--ink-soft)", padding: "4px 10px", fontSize: "11px" }}
                      >
                        🔒 بستن تیکت
                      </button>
                    )}
                    {(activeTicket.status === "resolved" || activeTicket.status === "closed") && (
                      <button
                        onClick={() => handleUpdateStatus("open")}
                        className="btn sm"
                        style={{ border: "1px solid var(--accent)", color: "var(--accent)", padding: "4px 10px", fontSize: "11px" }}
                      >
                        🔄 باز کردن مجدد
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "16px", marginTop: "12px", fontSize: "12px", color: "var(--ink-soft)" }}>
                  <span>ثبت‌کننده: {activeTicket.creator.firstName} {activeTicket.creator.lastName}</span>
                  {activeTicket.assignee && (
                    <span style={{ color: "var(--accent)", fontWeight: "bold" }}>
                      👤 منتسب به: {activeTicket.assignee.firstName} {activeTicket.assignee.lastName}
                    </span>
                  )}
                  <span>تاریخ ثبت: {formatDate(activeTicket.createdAt)}</span>
                </div>
              </div>

              {/* فرم ارجاع تیکت به همکار دیگر */}
              {isForwardOpen && activeTicket.status !== "closed" && (
                <div style={{ background: "rgba(30,41,59,0.02)", padding: "16px", borderRadius: "8px", border: "1px dashed var(--accent)", animation: "slideDown 0.15s ease-out" }}>
                  <form onSubmit={handleForwardTicket} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "12px", color: "var(--ink-soft)" }}>انتخاب همکار:</label>
                        <select
                          value={forwardTargetId}
                          onChange={(e) => setForwardTargetId(e.target.value)}
                          style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)" }}
                          required
                        >
                          <option value="">-- انتخاب همکار --</option>
                          {personnel
                            .filter((p) => p.id !== currentUser.id)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.firstName} {p.lastName}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "12px", color: "var(--ink-soft)" }}>یادداشت ارجاع (شرح اقدام/دستورالعمل):</label>
                        <input
                          type="text"
                          value={forwardNote}
                          onChange={(e) => setForwardNote(e.target.value)}
                          placeholder="مثلاً: همکار گرامی، لطفاً کنترل بفرمایید..."
                          style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)" }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                      <button type="button" onClick={() => setIsForwardOpen(false)} className="btn sm">انصراف</button>
                      <button type="submit" disabled={isPending} className="btn primary sm">ثبت و ارجاع تیکت</button>
                    </div>
                  </form>
                </div>
              )}

              {/* تاریخچه گردش کار تیکت (خط سیر Forward) */}
              <div style={{ background: "var(--panel-2)", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--line-soft)" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "12px", color: "var(--ink-soft)" }}>⚙️ گردش کار و تاریخچه ارجاعات تیکت:</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {activeTicket.history.map((hist, index) => (
                    <div
                      key={hist.id || index}
                      style={{
                        fontSize: "11px",
                        color: "var(--ink-soft)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        borderRight: "2px solid var(--accent)",
                        paddingRight: "8px",
                      }}
                    >
                      <span style={{ fontSize: "10px", color: "var(--ink-faint)" }}>
                        {formatDate(hist.createdAt).split(" ")[1]}
                      </span>
                      <span>
                        {hist.action === "CREATE" ? (
                          <>
                            📝 ثبت اولیه تیکت توسط <strong>{hist.fromUser?.firstName} {hist.fromUser?.lastName}</strong>
                            {hist.toUser && <> و ارجاع مستقیم به <strong>{hist.toUser.firstName} {hist.toUser.lastName}</strong></>}
                          </>
                        ) : hist.action === "REASSIGN" ? (
                          <>
                            🔗 ارجاع تیکت توسط <strong>{hist.fromUser?.firstName} {hist.fromUser?.lastName}</strong> به <strong>{hist.toUser?.firstName} {hist.toUser?.lastName}</strong>
                            {hist.note && <span style={{ color: "var(--ink-soft)", fontStyle: "italic", marginRight: "6px" }}>({hist.note})</span>}
                          </>
                        ) : hist.action === "REPLY" ? (
                          <>
                            💬 ثبت پاسخ توسط <strong>{hist.fromUser?.firstName} {hist.fromUser?.lastName}</strong>
                          </>
                        ) : (
                          <>
                            ⚙️ {hist.note} توسط <strong>{hist.fromUser?.firstName} {hist.fromUser?.lastName}</strong>
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* تاریخچه گفتگوها */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", minHeight: "200px" }}>
                
                {/* شرح اولیه تیکت */}
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(30,41,59,0.02)",
                    border: "1px solid var(--line-soft)",
                    alignSelf: activeTicket.creatorId === currentUser.id ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "13.5px", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {activeTicket.body}
                  </p>
                </div>

                {/* لیست پاسخ‌ها */}
                {activeTicket.replies.map((reply) => {
                  const isOwnReply = reply.userId === currentUser.id;
                  const replier = personnel.find((p) => p.id === reply.userId);
                  
                  return (
                    <div
                      key={reply.id}
                      style={{
                        padding: "12px 16px",
                        borderRadius: "8px",
                        backgroundColor: isOwnReply ? "var(--accent-soft)" : "rgba(30,41,59,0.03)",
                        border: isOwnReply ? "1px solid var(--accent-light, var(--line))" : "1px solid var(--line-soft)",
                        alignSelf: isOwnReply ? "flex-end" : "flex-start",
                        maxWidth: "85%",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {reply.body}
                      </p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: "var(--ink-faint)", marginTop: "4px" }}>
                        <span>
                          {isOwnReply ? "شما" : replier ? `${replier.firstName} ${replier.lastName}` : "همکار"}
                        </span>
                        <span style={{ fontFamily: "var(--mono)" }}>{formatDate(reply.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}

              </div>

              {/* فرم ارسال پاسخ */}
              {activeTicket.status !== "closed" ? (
                <form onSubmit={handleSendReply} style={{ borderTop: "1px solid var(--line)", paddingTop: "16px", display: "flex", gap: "10px", alignItems: "flex-end" }}>
                  <textarea
                    rows={2}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="پاسخ خود را اینجا بنویسید..."
                    style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)", fontFamily: "inherit", resize: "none" }}
                    required
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="btn primary"
                    style={{ padding: "10px 16px" }}
                  >
                    {isPending ? "در حال ارسال..." : "📤 ارسال پاسخ"}
                  </button>
                </form>
              ) : (
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: "16px", textAlign: "center", color: "var(--ink-soft)", fontSize: "13px" }}>
                  🔒 این تیکت بسته شده است و امکان ثبت پاسخ جدید برای آن وجود ندارد.
                </div>
              )}

            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)" }}>
              <span style={{ fontSize: "48px" }}>📬</span>
              <p style={{ marginTop: "12px", fontSize: "14px" }}>لطفاً یک تیکت را از لیست انتخاب نمایید تا تاریخچه گفتگو نمایش داده شود.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
