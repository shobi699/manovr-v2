"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import DataTable, { Column } from "@/components/DataTable";
import { saveDashboardLayoutAction } from "@/app/actions/dashboard";
import {
  sendAdminMessage,
  createTicket,
  getTicketsList,
  replyToTicket,
  updateTicketStatus,
} from "@/app/actions/tickets";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

interface Widget {
  id: string;
  title: string;
  visible: boolean;
}

interface DashboardClientProps {
  initialLayout: Widget[] | null;
  pendingCount: number;
  isManager: boolean;
  kpiData: {
    totalLines: number;
    occupiedLines: number;
    activeTrains: number;
    activeManovrs: number;
    totalPersonnel: number;
    totalManovrs: number;
  };
  terminalGroups: {
    termName: string;
    lines: any[];
  }[];
  recentManovrs: any[];
  typeDistribution: { name: string; value: number }[];
  trendData: { date: string; count: number }[];
  personnelList: { id: number; firstName: string; lastName: string }[];
  currentUser: { id: number; fullName: string; role: number };
}

const DEFAULT_LAYOUT: Widget[] = [
  { id: "kpi_tiles", title: "کارت‌های آمار کلیدی (KPI)", visible: true },
  { id: "tickets_support", title: "تیکت‌ها و درخواست‌های پشتیبانی پرسنل", visible: true },
  { id: "charts_distribution", title: "نمودار توزیع نوع مانورها", visible: true },
  { id: "recent_manovrs", title: "آخرین مانورهای پایانه", visible: true },
  { id: "charts_trend", title: "نمودار روند روزانه مانورها", visible: true },
  { id: "depot_grid", title: "وضعیت ریل‌های پایانه", visible: true },
  { id: "admin_messages", title: "اطلاعیه‌ها و پیام‌های مدیریت", visible: true },
];

const COLORS = ["#1f3a5f", "#d8842a", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

export default function DashboardClient({
  initialLayout,
  pendingCount,
  isManager,
  kpiData,
  terminalGroups,
  recentManovrs,
  typeDistribution,
  trendData,
  personnelList,
  currentUser,
}: DashboardClientProps) {
  const [layout, setLayout] = useState<Widget[]>(() => {
    const base = initialLayout || DEFAULT_LAYOUT;
    const merged = [...base];
    DEFAULT_LAYOUT.forEach((w) => {
      if (!merged.some((item) => item.id === w.id)) {
        merged.push(w);
      }
    });
    return merged;
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPending, startTransition] = useTransition();

  // وضعیت‌های مربوط به تیکتینگ و پیام‌ها
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [activeTicket, setActiveTicket] = useState<any | null>(null);

  const [newTicketTitle, setNewTicketTitle] = useState("");
  const [newTicketBody, setNewTicketBody] = useState("");
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);

  const [replyBody, setReplyBody] = useState("");

  const [msgTitle, setMsgTitle] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [msgKind, setMsgKind] = useState<"info" | "success" | "warning" | "alert">("info");
  const [msgTarget, setMsgTarget] = useState<string>(""); // خالی یعنی همگانی

  const fetchTickets = async () => {
    setLoadingTickets(true);
    const res = await getTicketsList();
    if (res.ok && res.data) {
      setTickets(res.data);
      if (activeTicket) {
        const updated = res.data.find((t: any) => t.id === activeTicket.id);
        if (updated) setActiveTicket(updated);
      }
    }
    setLoadingTickets(false);
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newLayout = [...layout];
    const temp = newLayout[index];
    newLayout[index] = newLayout[index - 1];
    newLayout[index - 1] = temp;
    setLayout(newLayout);
  };

  const handleMoveDown = (index: number) => {
    if (index === layout.length - 1) return;
    const newLayout = [...layout];
    const temp = newLayout[index];
    newLayout[index] = newLayout[index + 1];
    newLayout[index + 1] = temp;
    setLayout(newLayout);
  };

  const handleToggleVisible = (id: string) => {
    setLayout(
      layout.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await saveDashboardLayoutAction(layout, "user");
      if (res.ok) {
        setIsEditMode(false);
      } else {
        alert("خطا در ذخیره چیدمان");
      }
    });
  };

  const handleReset = () => {
    setLayout(DEFAULT_LAYOUT);
  };

  // ارسال پیام سراسری یا خصوصی توسط مدیر
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgTitle.trim() || !msgBody.trim()) return alert("لطفاً عنوان و متن پیام را وارد کنید.");

    startTransition(async () => {
      const res = await sendAdminMessage({
        title: msgTitle,
        body: msgBody,
        kind: msgKind,
        targetUserId: msgTarget ? Number(msgTarget) : null,
      });

      if (!res.ok) {
        alert(res.error || "خطا در ارسال پیام");
      } else {
        alert("پیام و اعلان با موفقیت ثبت و ارسال شد.");
        setMsgTitle("");
        setMsgBody("");
      }
    });
  };

  // ایجاد تیکت پشتیبانی جدید توسط کاربر
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketTitle.trim() || !newTicketBody.trim()) return alert("لطفاً عنوان و متن تیکت را وارد کنید.");

    startTransition(async () => {
      const res = await createTicket(newTicketTitle, newTicketBody);
      if (!res.ok) {
        alert(res.error || "خطا در ثبت تیکت");
      } else {
        alert("تیکت شما با موفقیت ثبت شد و به مدیران ابلاغ گردید.");
        setNewTicketTitle("");
        setNewTicketBody("");
        setShowNewTicketForm(false);
        fetchTickets();
      }
    });
  };

  // ثبت پاسخ روی تیکت
  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim() || !activeTicket) return;

    startTransition(async () => {
      const res = await replyToTicket(activeTicket.id, replyBody);
      if (!res.ok) {
        alert(res.error || "خطا در ثبت پاسخ");
      } else {
        setReplyBody("");
        fetchTickets();
      }
    });
  };

  // تغییر وضعیت تیکت (حل شده / بسته شده)
  const handleStatusChange = async (ticketId: number, status: "resolved" | "closed" | "open") => {
    startTransition(async () => {
      const res = await updateTicketStatus(ticketId, status);
      if (!res.ok) {
        alert(res.error || "خطا در تغییر وضعیت");
      } else {
        fetchTickets();
      }
    });
  };

  const renderWidget = (id: string) => {
    switch (id) {
      case "kpi_tiles":
        return (
          <div className="tiles" key="kpi_tiles" style={{ marginBottom: "20px" }}>
            <div className="tile"><div className="n rail">{kpiData.totalLines}</div><div className="l">خطوط</div></div>
            <div className="tile"><div className="n warn">{kpiData.occupiedLines}</div><div className="l">خطوط اشغال‌شده</div></div>
            <div className="tile"><div className="n">{kpiData.activeTrains}</div><div className="l">قطار فعال</div></div>
            <div className="tile"><div className="n good">{kpiData.activeManovrs}</div><div className="l">مانور در جریان</div></div>
            <div className="tile"><div className="n">{kpiData.totalPersonnel}</div><div className="l">پرسنل</div></div>
            <div className="tile"><div className="n">{kpiData.totalManovrs}</div><div className="l">کل مانورها</div></div>
          </div>
        );

      case "depot_grid":
        return (
          <div key="depot_grid" style={{ marginBottom: "24px" }}>
            {terminalGroups.map((tg, idx) => (
              <div className="term-group" key={idx} style={{ marginBottom: "16px" }}>
                <h3>
                  {tg.termName}
                  <span className="cnt">{tg.lines.length} خط</span>
                </h3>
                <div className="lines-grid">
                  {tg.lines.map((l) => (
                    <div className={`line-cell${l.trains.length > 0 ? " occupied" : ""}`} key={l.id}>
                      <div className="lname">{l.name}</div>
                      {l.trains.length > 0 ? (
                        <div className="ltrain">قطار {l.trains.join("، ")}</div>
                      ) : (
                        <div className="lempty">خالی · ظرفیت {l.capacity}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );

      case "recent_manovrs":
        return (
          <div className="card" key="recent_manovrs" style={{ padding: "20px", marginBottom: "24px" }}>
            <div className="card-head" style={{ borderBottom: "1px solid var(--line)", paddingBottom: "10px", marginBottom: "14px" }}>
              <h2>آخرین مانورهای ثبت شده در پایانه</h2>
              <span className="spacer" />
              <Link href="/manovrs" className="btn sm outline">مشاهده تاریخچه مانورها ➔</Link>
            </div>
            <div style={{ overflowX: "auto" }}>
              <DataTable
                tableName="dashboardRecentManovrs"
                columns={[
                  { key: "id", label: "کد مانور", sortable: true, filterable: true, render: (m) => <span className="num">{m.id}</span> },
                  { key: "train", label: "قطار", sortable: true, filterable: true, getValue: (m) => m.train?.code, render: (m) => <span className="num"><b>{m.train?.code}</b></span> },
                  { key: "line", label: "خط مبدأ ← مقصد", filterable: true, getValue: (m) => `${m.sourceLine?.name || "—"} ➔ ${m.destinationLine?.name}`, render: (m) => <><span className="muted">{m.sourceLine?.name || "—"}</span>{" ➔ "}<b>{m.destinationLine?.name}</b></> },
                  { key: "rahbar", label: "راهبر", filterable: true, getValue: (m) => m.rahbar1 ? `${m.rahbar1.firstName} ${m.rahbar1.lastName}` : "—" },
                  { key: "createdAt", label: "زمان ثبت", sortable: true, filterable: true, getValue: (m) => new Date(m.createdAt).toLocaleDateString("fa-IR", { calendar: "persian" }), render: (m) => <span className="num muted">{new Date(m.createdAt).toLocaleDateString("fa-IR", { calendar: "persian" })}</span> }
                ]}
                data={recentManovrs}
              />
            </div>
          </div>
        );

      case "charts_distribution":
        return (
          <div className="grid2" key="charts_distribution" style={{ marginBottom: "24px" }}>
            <div className="card" style={{ padding: "20px" }}>
              <div className="card-head" style={{ marginBottom: "16px" }}>
                <h2>توزیع انواع مانورها (تعداد کل)</h2>
              </div>
              <div style={{ height: "260px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${percent ? (percent * 100).toFixed(0) : 0}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {typeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card" style={{ padding: "20px" }}>
              <div className="card-head" style={{ marginBottom: "16px" }}>
                <h2>فراوانی حجم مانور به تفکیک نوع</h2>
              </div>
              <div style={{ height: "260px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );

      case "charts_trend":
        return (
          <div className="card" key="charts_trend" style={{ padding: "20px", marginBottom: "24px" }}>
            <div className="card-head" style={{ marginBottom: "16px" }}>
              <h2>روند اجرای مانورها (۱۰ روز گذشته)</h2>
            </div>
            <div style={{ height: "280px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case "admin_messages":
        return (
          <div className="card" key="admin_messages" style={{ padding: "20px", marginBottom: "24px" }}>
            <div className="card-head" style={{ borderBottom: "1px solid var(--line)", paddingBottom: "10px", marginBottom: "14px" }}>
              <h2>📢 اطلاعیه‌ها و ارسال پیام مدیریت پایانه</h2>
            </div>
            {isManager ? (
              <form onSubmit={handleSendMessage} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div className="grid2">
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>عنوان پیام *</label>
                    <input
                      type="text"
                      className="input"
                      value={msgTitle}
                      onChange={(e) => setMsgTitle(e.target.value)}
                      placeholder="مثال: اعلام وضعیت قرمز آب و هوایی"
                      required
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>مخاطب پیام *</label>
                    <select
                      className="input"
                      value={msgTarget}
                      onChange={(e) => setMsgTarget(e.target.value)}
                    >
                      <option value="">همگانی (Broadcast به همه پرسنل)</option>
                      {personnelList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid2">
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>نوع/شدت پیام *</label>
                    <select
                      className="input"
                      value={msgKind}
                      onChange={(e) => setMsgKind(e.target.value as any)}
                    >
                      <option value="info">اطلاعیه عمومی (Info - آبی)</option>
                      <option value="success">اطلاعیه موفقیت (Success - سبز)</option>
                      <option value="warning">هشدار عملیاتی (Warning - نارنجی)</option>
                      <option value="alert">اعلام خطر اضطراری (Alert - قرمز)</option>
                    </select>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }} />
                </div>

                <div className="field">
                  <label>متن اطلاعیه / رهنمود عملیاتی *</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={msgBody}
                    onChange={(e) => setMsgBody(e.target.value)}
                    placeholder="متن پیام خود را برای پرسنل و راهبران بنویسید..."
                    required
                  />
                </div>

                <button type="submit" className="btn primary" disabled={isPending}>
                  {isPending ? "در حال ارسال..." : "📣 ارسال و انتشار پیام"}
                </button>
              </form>
            ) : (
              <div style={{ padding: "20px 10px", textAlign: "center", color: "var(--ink-soft)" }}>
                <span>فقط کاربران با دسترسی مدیریت می‌توانند اطلاعیه جدید ارسال کنند. پیام‌ها در منوی زنگوله بالای صفحه به اطلاع شما می‌رسد.</span>
              </div>
            )}
          </div>
        );

      case "tickets_support":
        return (
          <div className="grid2" key="tickets_support" style={{ marginBottom: "24px", gap: "20px" }}>
            {/* لیست تیکت‌ها */}
            <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column" }}>
              <div className="card-head" style={{ borderBottom: "1px solid var(--line)", paddingBottom: "10px", marginBottom: "14px" }}>
                <h2>📬 تیکت‌ها و درخواست‌های پشتیبانی</h2>
                <span className="spacer" />
                <button className="btn sm primary" onClick={() => setShowNewTicketForm(!showNewTicketForm)}>
                  {showNewTicketForm ? "بستن فرم" : "➕ ثبت تیکت جدید"}
                </button>
              </div>

              {showNewTicketForm && (
                <form onSubmit={handleCreateTicket} style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "12px", border: "1px dashed var(--accent)", borderRadius: "8px", marginBottom: "16px" }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>موضوع درخواست پشتیبانی *</label>
                    <input
                      type="text"
                      className="input"
                      value={newTicketTitle}
                      onChange={(e) => setNewTicketTitle(e.target.value)}
                      placeholder="مثال: خرابی سیستم تهویه قطار ۷۰۱"
                      required
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>شرح دقیق مشکل یا درخواست *</label>
                    <textarea
                      className="input"
                      rows={3}
                      value={newTicketBody}
                      onChange={(e) => setNewTicketBody(e.target.value)}
                      placeholder="توضیحات لازم را در اینجا وارد کنید..."
                      required
                    />
                  </div>
                  <button type="submit" className="btn sm primary" disabled={isPending}>
                    {isPending ? "در حال ثبت..." : "ارسال تیکت به مدیریت"}
                  </button>
                </form>
              )}

              {loadingTickets ? (
                <div style={{ textAlign: "center", padding: "30px", color: "var(--ink-soft)" }}>در حال دریافت اطلاعات...</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "350px", overflowY: "auto" }}>
                  {tickets.map((t) => {
                    const statusText = t.status === "open" ? "باز" : t.status === "resolved" ? "حل شده" : "بسته شده";
                    const statusClass = t.status === "open" ? "p-crit" : t.status === "resolved" ? "p-good" : "p-neutral";
                    return (
                      <div
                        key={t.id}
                        onClick={() => setActiveTicket(t)}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "8px",
                          border: activeTicket?.id === t.id ? "1px solid var(--accent)" : "1px solid var(--line-soft)",
                          backgroundColor: activeTicket?.id === t.id ? "var(--panel-2)" : "transparent",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          transition: "var(--transition-fluid)",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: "bold", fontSize: "13px" }}>{t.title}</div>
                          <div className="muted" style={{ fontSize: "11px", marginTop: "4px" }}>
                            توسط: {t.creator?.firstName} {t.creator?.lastName} · {new Date(t.createdAt).toLocaleDateString("fa-IR", { calendar: "persian" })}
                          </div>
                        </div>
                        <span className={`pill ${statusClass}`} style={{ fontSize: "10px", padding: "2px 6px" }}>{statusText}</span>
                      </div>
                    );
                  })}
                  {tickets.length === 0 && (
                    <div style={{ padding: "30px", textAlign: "center", color: "var(--ink-faint)", fontSize: "12px" }}>
                      هیچ درخواست یا تیکتی ثبت نشده است.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* جزئیات و گفتگو در تیکت فعال */}
            <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", minHeight: "300px" }}>
              {activeTicket ? (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "14px" }}>
                  <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ fontSize: "14px", fontWeight: "bold" }}>{activeTicket.title}</h3>
                      <span className="muted" style={{ fontSize: "11px" }}>
                        ثبت تیکت: {new Date(activeTicket.createdAt).toLocaleDateString("fa-IR", { calendar: "persian" })}
                      </span>
                    </div>
                    {isManager && activeTicket.status === "open" && (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button className="btn sm good" onClick={() => handleStatusChange(activeTicket.id, "resolved")}>
                          حل شده
                        </button>
                        <button className="btn sm outline text-crit" onClick={() => handleStatusChange(activeTicket.id, "closed")}>
                          بستن
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ padding: "10px 14px", backgroundColor: "var(--panel-2)", borderRadius: "8px", borderRight: "3px solid var(--accent)", fontSize: "13px" }}>
                      <strong>شرح درخواست پرسنل:</strong>
                      <p style={{ margin: "4px 0 0 0", color: "var(--ink-soft)" }}>{activeTicket.body}</p>
                    </div>

                    <div style={{ borderTop: "1px dashed var(--line-soft)", paddingTop: "10px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "bold", color: "var(--ink-soft)" }}>گفتگو و پاسخ‌ها:</span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "160px", overflowY: "auto", padding: "4px" }}>
                      {activeTicket.replies?.map((rep: any) => {
                        const isAuthorMe = rep.userId === currentUser.id;
                        return (
                          <div
                            key={rep.id}
                            style={{
                              alignSelf: isAuthorMe ? "flex-end" : "flex-start",
                              backgroundColor: isAuthorMe ? "var(--accent-soft)" : "var(--panel-2)",
                              color: isAuthorMe ? "var(--accent)" : "inherit",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              maxWidth: "85%",
                              fontSize: "12px",
                            }}
                          >
                            <p style={{ margin: 0 }}>{rep.body}</p>
                            <span style={{ fontSize: "9px", opacity: 0.7, display: "block", marginTop: "2px", textAlign: "left" }}>
                              {new Date(rep.createdAt).toLocaleTimeString("fa-IR")}
                            </span>
                          </div>
                        );
                      })}
                      {(!activeTicket.replies || activeTicket.replies.length === 0) && (
                        <div style={{ textAlign: "center", padding: "10px", fontSize: "11px", color: "var(--ink-faint)" }}>
                          هنوز پاسخی روی این تیکت ثبت نشده است.
                        </div>
                      )}
                    </div>
                  </div>

                  <form onSubmit={handleReplySubmit} style={{ display: "flex", gap: "8px", borderTop: "1px solid var(--line)", paddingTop: "12px" }}>
                    <input
                      type="text"
                      className="input sm"
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="پاسخ خود را بنویسید..."
                      style={{ flex: 1 }}
                      required
                    />
                    <button type="submit" className="btn sm primary" disabled={isPending}>
                      ارسال
                    </button>
                  </form>
                </div>
              ) : (
                <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", color: "var(--ink-faint)", fontSize: "12px" }}>
                  یک تیکت را برای مشاهده جزئیات گفتگو انتخاب کنید.
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <PageHeader
        title="داشبورد و آمار پایانه"
        breadcrumb={[{ label: "تحلیل و تنظیمات" }, { label: "داشبورد و آمار" }]}
        actions={
          isEditMode ? (
            <>
              <button onClick={handleSave} className="btn primary" disabled={isPending}>
                {isPending ? "در حال ذخیره‌سازی..." : "ذخیره چیدمان"}
              </button>
              <button onClick={handleReset} className="btn outline">
                پیش‌فرض
              </button>
              <button onClick={() => setIsEditMode(false)} className="btn outline">
                انصراف
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditMode(true)} className="btn primary outline">
              شخصی‌سازی چیدمان داشبورد
            </button>
          )
        }
      />

      <div className="content">
        
        {/* پنل شخصی‌سازی (فقط در حالت ویرایش فعال می‌شود) */}
        {isEditMode && (
          <div 
            className="card" 
            style={{ 
              padding: "20px", 
              marginBottom: "20px", 
              backgroundColor: "rgba(30,41,59,0.06)", 
              border: "1px dashed var(--accent)" 
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "10px" }}>
              ترتیب و نمایش ابزارک‌های داشبورد را تغییر دهید:
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {layout.map((w, idx) => (
                <div 
                  key={w.id} 
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between", 
                    padding: "10px 14px", 
                    backgroundColor: "var(--panel)", 
                    borderRadius: "8px",
                    border: "1px solid var(--line)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button 
                      onClick={() => handleToggleVisible(w.id)}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: "18px",
                        cursor: "pointer",
                      }}
                    >
                      {w.visible ? "👁️" : "🙈"}
                    </button>
                    <span style={{ fontSize: "13px", fontWeight: w.visible ? "bold" : "normal", opacity: w.visible ? 1 : 0.5 }}>
                      {w.title}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button onClick={() => handleMoveUp(idx)} className="btn sm outline" disabled={idx === 0}>▲</button>
                    <button onClick={() => handleMoveDown(idx)} className="btn sm outline" disabled={idx === layout.length - 1}>▼</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isManager && pendingCount > 0 && (
          <Link
            href="/manovrs/approvals"
            style={{
              textDecoration: "none",
              display: "block",
              marginBottom: "20px"
            }}
          >
            <div 
              className="card animate-pulse" 
              style={{ 
                padding: "16px 20px", 
                borderRadius: "12px", 
                border: "1px solid var(--accent)", 
                background: "linear-gradient(135deg, rgba(216, 132, 42, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "24px" }}>⚠️</span>
                <div>
                  <h4 style={{ margin: 0, color: "var(--accent)", fontSize: "14px", fontWeight: "bold" }}>مانورهای منتظر تأیید و بستن</h4>
                  <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "12px" }}>
                    تعداد <b>{pendingCount}</b> مانور در پایانه ثبت شده که نیاز به بررسی و تأیید نهایی یا بستن دارند.
                  </p>
                </div>
              </div>
              <span className="btn sm accent" style={{ cursor: "pointer" }}>بررسی و تأیید ➔</span>
            </div>
          </Link>
        )}

        {/* رندر ابزارک‌ها بر اساس چیدمان فعال */}
        {layout
          .filter((w) => w.visible)
          .map((w) => renderWidget(w.id))}

      </div>
    </>
  );
}
