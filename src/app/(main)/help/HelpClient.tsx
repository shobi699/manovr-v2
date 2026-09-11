"use client";

import React, { useState, useMemo } from "react";
import {
  BookOpen,
  ArrowsLeftRight,
  MapTrifold,
  ShieldCheck,
  FileText,
  Keyboard,
  Question,
  MagnifyingGlass,
  CheckCircle,
  Lightning,
  Wrench,
  Prohibit,
  Info,
  Train,
  Check,
  Copy,
} from "@phosphor-icons/react";

interface HelpClientProps {
  userRole: number;
}

export default function HelpClient({ userRole }: HelpClientProps) {
  const [activeTab, setActiveTab] = useState<"workflows" | "encyclopedia" | "shortcuts" | "faq">("workflows");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // داده‌های گردش کارهای عملیاتی
  const workflows = [
    {
      id: "wf-manovr-create",
      title: "۱. نحوه ثبت و اجرای مانور جدید",
      icon: ArrowsLeftRight,
      color: "var(--accent)",
      steps: [
        {
          title: "ورود به فرم ثبت مانور",
          desc: "از منوی سایدبار گزینه «ثبت مانور جدید» را انتخاب کنید یا در صفحه دپو با کلیک راست روی خط یا استفاده از دکمه «+ مانور جدید» فرم را باز کنید.",
        },
        {
          title: "انتخاب قطار و نوع عملیات",
          desc: "قطار مورد نظر را مشخص نمایید. خط مبدا به صورت خودکار بر اساس موقعیت فعلی قطار در دپو پر می‌شود. نوع مانور (مانند جابجایی، اعزام، شستشو یا انتقال دائم) را انتخاب کنید.",
        },
        {
          title: "تعیین خط مقصد و راهبران",
          desc: "خط مقصد را انتخاب کنید. ظرفیت باقیمانده خط به صورت خودکار محاسبه و کنترل می‌شود. راهبر ۱ (الزامی) و راهبر ۲ (اختیاری) را تعیین کنید.",
        },
        {
          title: "ثبت اتمیک و اعمال در دپو",
          desc: "با زدن دکمه «ثبت مانور»، سند مانور صادر شده، وضعیت به «در حال اجرا» تغییر یافته و قطار فوراً روی ریل مقصد در نقشه دپو قرار می‌گیرد.",
        },
      ],
    },
    {
      id: "wf-depot-interaction",
      title: "۲. کار با نقشه پایانه و جابجایی قطارها (۲بعدی و ۳بعدی)",
      icon: MapTrifold,
      color: "var(--rail)",
      steps: [
        {
          title: "انتخاب نما (سه‌بعدی / بنتو / نقشه / کلاسیک)",
          desc: "از بالای صفحه دپو می‌توانید بین نمای تعاملی سه‌بعدی Three.js، نمای ساختاریافته ۵ ستونی (ترمینال‌ها)، نمای نقشه با قابلیت چرخش زاویه یا نمای کلاسیک سوئیچ کنید.",
        },
        {
          title: "جابجایی با کشیدن و رها کردن (Drag & Drop)",
          desc: "کارت هر قطار را گرفته و روی خط ریل مقصد رها کنید. سیستم به صورت بلادرنگ ظرفیت خط را بررسی کرده و فرم مانور سریع را باز می‌کند.",
        },
        {
          title: "مشاهده و تغییر وضعیت فنی قطار",
          desc: "با کلیک روی کارت هر قطار، پنجره مشخصات فنی باز می‌شود. کاربران دارای مجوز می‌توانند موعد دوار (A/B/C)، وضعیت کفشک، ATP و مجوز حرکت را مستقیماً تنظیم کنند.",
        },
      ],
    },
    {
      id: "wf-approvals",
      title: "۳. فرآیند کنترل و تأیید شیفت مانورها",
      icon: ShieldCheck,
      color: "var(--good)",
      steps: [
        {
          title: "کارتابل تأیید و کنترل مانورها",
          desc: "مسئولین شیفت و مدیران از طریق منوی «تأیید و کنترل مانورها» لیست مانورهای خاتمه‌یافته که نیاز به تأیید نهایی دارند را مشاهده می‌کنند.",
        },
        {
          title: "بررسی انطباق زمانی و راهبران",
          desc: "جزئیات ثبت شامل زمان دقیق شروع و پایان، راهبران مانوردهنده و خطوط مبدا/مقصد را بررسی نمایید.",
        },
        {
          title: "تأیید نهایی یا ثبت علت رد",
          desc: "با کلیک بر روی دکمه «تأیید»، وضعیت سند به تأییدشده تغییر می‌کند. در صورت عدم انطباق با فشردن «رد»، علت رد ثبت شده و مانور جهت بازبینی علامت می‌خورد.",
        },
      ],
    },
    {
      id: "wf-reports",
      title: "۴. ساخت گزارش‌های پویا و خروجی اکسل/PDF",
      icon: FileText,
      color: "var(--warn)",
      steps: [
        {
          title: "انتخاب موجودیت و فیلدهای دلخواه",
          desc: "در بخش «گزارش‌ساز پویا»، نوع موجودیت (مانورها، قطارها، پرسنل یا خطوط) را انتخاب کرده و فیلدهای مدنظرتان را علامت بزنید.",
        },
        {
          title: "اعمال فیلترهای پیشرفته و بازه زمانی شمسی",
          desc: "فیلترهایی چون شیفت کاری، نوع قطار، بازه تاریخ جلالی، وضعیت تایید یا راهبر را اضافه کنید.",
        },
        {
          title: "دریافت خروجی استاندارد و راست‌چین",
          desc: "خروجی Excel با جهت کاملاً راست‌چین و فونت استاندارد یا خروجی PDF با فونت فارسی وزیرمتن و تاریخ‌های خورشیدی تهران آماده دانلود است.",
        },
      ],
    },
  ];

  // دانشنامه اصطلاحات تخصصی پایانه
  const encyclopedia = [
    {
      term: "قطار AC (برق متناوب)",
      category: "ناوگان",
      desc: "قطارهای نسل جدید متروی تهران که با برق متناوب کار کرده و مجهز به تجهیزات پیشرفته کنترلی VVVF هستند. در نقشه با نشان آبی و برچسب AC مشخص می‌شوند.",
    },
    {
      term: "قطار DC (برق مستقیم)",
      category: "ناوگان",
      desc: "قطارهای سنتی و دیزلی/برقی مستقیم پایانه که عموماً برای مانورهای سنگین یا خطوط قدیمی استفاده می‌شوند. در سامانه با نشان DC تفکیک می‌گردند.",
    },
    {
      term: "سیستم ATP (حفاظت خودکار قطار)",
      category: "ایمنی و علائم",
      desc: "سامانه Automatic Train Protection که سرعت مجاز، فاصله ایمن با قطار جلویی و فرمان‌های توقف اضطراری را کنترل می‌کند. در صورت غیرفعال بودن (عدم ATP)، قطار تنها با مجوز ویژه و اسکورت مانوری مجاز به جابجایی در پایانه است.",
    },
    {
      term: "کفشک خط گرم (Third Rail Current Collector)",
      category: "تجهیزات ریل",
      desc: "بازوی تماسی قطار که نیروی برق ۷۵۰ ولت را از ریل سوم دریافت می‌کند. در خطوط تعمیراتی و سوله‌های بازدید، وضعیت کفشک قطار باید جهت جلوگیری از برق‌گرفتگی یا شکستگی در سیستم ثبت شود.",
    },
    {
      term: "موعدهای دوار (Rotary Schedules - A/B/C)",
      category: "تعمیرات و نگهداری",
      desc: "برنامه زمان‌بندی بازرسی‌های دوره‌ای ناوگان: موعد A برای چک روزانه و سبک، موعد B برای سرویس میان‌دوره، و موعد C برای اورهال اساسی و تعمیرات سنگین در دپو.",
    },
    {
      term: "مانور انتقال دائم (Permanent Transfer)",
      category: "عملیات مانور",
      desc: "مانوری که طی آن قطار به طور رسمی از حریم پایانه فتح‌آباد خارج شده و به خطوط تجاری یا دپوی خط دیگر اعزام می‌شود. این مانور ظرفیت خطوط پایانه را آزاد می‌کند.",
    },
    {
      term: "ظرفیت خط و جایگاه (Slot Index)",
      category: "دپو و ریل",
      desc: "هر ریل در پایانه دارای ظرفیت مشخص بر مبنای طول (تعداد واگن/قطار) است. جایگاه پارک روی ریل با Slot Index از ابتدای ریل تا انتهای آن شماره‌گذاری می‌شود.",
    },
    {
      term: "پایانه فتح‌آباد (Fathabad Depot)",
      category: "موقعیت جغرافیایی",
      desc: "مرکز نگهداری و تعمیرات اساسی قطارهای خط ۱ متروی تهران واقع در انتهای جنوبی خط، شامل پایانه‌های شستشو، سوله‌های تعمیرات سبک، تراش چرخ و خطوط استندبای اعزام.",
    },
  ];

  // کلیدهای میانبر
  const shortcuts = [
    { key: "Esc", desc: "بستن تمامی پنجره‌های پاپ‌آپ، مودال‌ها و منوهای باز" },
    { key: "Ctrl + F", desc: "جستجوی بلادرنگ در جداول قطارها، مانورها و کاربران" },
    { key: "R", desc: "بارگذاری مجدد داده‌های زنده بدون رفرش کل مرورگر" },
    { key: "کلیک روی قطار", desc: "مشاهده کارت وضعیت فنی، ویرایش کفشک، ATP و موعد دوار" },
    { key: "درگ اند دراپ", desc: "انتقال قطار به خط ریل دیگر و باز شدن سریع فرم ثبت مانور" },
    { key: "کلیک راست روی خط", desc: "باز کردن سریع منوی اقدامات خط و ثبت مانور مستقیم" },
  ];

  // پرسش‌های متداول (FAQ)
  const faqs = [
    {
      q: "اگر ظرفیت خط مقصد پر باشد، آیا مانور ثبت می‌شود؟",
      a: "خیر؛ سامانه با کنترل اتمیک تراکنش‌های دیتابیس، در صورتی که تعداد قطارهای پارک‌شده روی خط مقصد با احتساب ظرفیت تعریف‌شده پر باشد، اجازه ثبت مانور را نداده و پیام «ظرفیت خط مقصد پر شده است» را نمایش می‌دهد.",
    },
    {
      q: "تفاوت نقش‌های کاربری (ادمین، مسئول شیفت، راهبر) در چیست؟",
      a: "سوپرادمین دسترسی نامحدود به تمامی زیرسیستم‌ها دارد؛ مسئول شیفت توانایی ایجاد کاربر در شیفت خود، تغییر شیفت پرسنل، و تأیید نهایی مانورها را دارد؛ راهبران تنها مجاز به ثبت مانورهای جاری و مشاهده اطلاعات عملیاتی پایانه هستند.",
    },
    {
      q: "آیا در صورت قطعی شبکه پایانه، اطلاعات از بین می‌رود؟",
      a: "سامانه دارای مکانیزم تلاش مجدد هوشمند (Exponential Backoff with Jitter) و حالت پشتیبان محلی (Local Fallback) است. پایگاه داده شبکه با زمان انتظار ۶۰ ثانیه و ژورنالینگ ایمن بدون ایجاد فایل معلق کار می‌کند.",
    },
    {
      q: "چرا تاریخ‌ها در گزارش‌های خروجی شمسی هستند؟",
      a: "مطابق استانداردهای رسمی سامانه، تمامی تاریخ‌ها و زمان‌ها در فرانت‌اند، گزارش‌ساز، خروجی‌های PDF و Excel در تقویم خورشیدی جلالی (fa-IR) با منطقه زمانی رسمی تهران (Asia/Tehran) رندر می‌شوند.",
    },
    {
      q: "چگونه می‌توان یک مانور اشتباه را لغو یا ویرایش کرد؟",
      a: "کاربران دارای مجوز ویرایش می‌توانند مانور را خاتمه داده یا در صورت نیاز از گزینه «حذف مانور» استفاده نمایند. حذف در سیستم به صورت نرم (Soft Delete) انجام می‌شود و اثر آن در لاگ وقایع امنیتی محفوظ می‌ماند.",
    },
  ];

  // فیلتر کردن بر اساس جستجو
  const filteredWorkflows = useMemo(() => {
    if (!searchQuery.trim()) return workflows;
    const q = searchQuery.toLowerCase();
    return workflows.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.steps.some((s) => s.title.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const filteredEncyclopedia = useMemo(() => {
    if (!searchQuery.trim()) return encyclopedia;
    const q = searchQuery.toLowerCase();
    return encyclopedia.filter(
      (e) =>
        e.term.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.desc.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqs;
    const q = searchQuery.toLowerCase();
    return faqs.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [searchQuery]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* سرچ‌باکس بزرگ و جستجوی لحظه‌ای */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "var(--panel)",
          padding: "12px 20px",
          borderRadius: "var(--radius)",
          border: "1px solid var(--line)",
          boxShadow: "var(--sh-1)",
        }}
      >
        <MagnifyingGlass size={22} color="var(--accent)" weight="bold" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="جستجو در آموزش‌ها، اصطلاحات دپو، گردش کارها و سوالات متداول..."
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: "0.95rem",
            color: "var(--ink)",
            fontFamily: "inherit",
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="btn btn-ghost"
            style={{ padding: "4px 8px", fontSize: "0.8rem", borderRadius: "6px" }}
          >
            پاک کردن
          </button>
        )}
      </div>

      {/* تب‌های ناوبری اصلی */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          background: "var(--panel-2)",
          padding: "6px",
          borderRadius: "var(--radius)",
          border: "1px solid var(--line)",
          overflowX: "auto",
        }}
      >
        <button
          onClick={() => setActiveTab("workflows")}
          className={`btn ${activeTab === "workflows" ? "btn-primary" : "btn-ghost"}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", borderRadius: "8px" }}
        >
          <ArrowsLeftRight size={18} />
          گردش کارهای عملیاتی
        </button>
        <button
          onClick={() => setActiveTab("encyclopedia")}
          className={`btn ${activeTab === "encyclopedia" ? "btn-primary" : "btn-ghost"}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", borderRadius: "8px" }}
        >
          <BookOpen size={18} />
          دانشنامه و اصطلاحات دپو
        </button>
        <button
          onClick={() => setActiveTab("shortcuts")}
          className={`btn ${activeTab === "shortcuts" ? "btn-primary" : "btn-ghost"}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", borderRadius: "8px" }}
        >
          <Keyboard size={18} />
          کلیدهای میانبر و نکات سریع
        </button>
        <button
          onClick={() => setActiveTab("faq")}
          className={`btn ${activeTab === "faq" ? "btn-primary" : "btn-ghost"}`}
          style={{ display: "flex", alignItems: "center", gap: "8px", borderRadius: "8px" }}
        >
          <Question size={18} />
          پرسش‌های متداول (FAQ)
        </button>
      </div>

      {/* تب ۱: گردش کارهای عملیاتی */}
      {activeTab === "workflows" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {filteredWorkflows.map((wf) => {
            const IconComp = wf.icon;
            return (
              <div
                key={wf.id}
                style={{
                  background: "var(--panel)",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--line)",
                  padding: "20px",
                  boxShadow: "var(--sh-1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: "var(--panel-2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: wf.color,
                    }}
                  >
                    <IconComp size={22} weight="bold" />
                  </div>
                  <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                    {wf.title}
                  </h2>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                    gap: "12px",
                  }}
                >
                  {wf.steps.map((step, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "var(--panel-2)",
                        borderRadius: "10px",
                        padding: "14px",
                        border: "1px solid var(--line)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            width: "22px",
                            height: "22px",
                            borderRadius: "50%",
                            background: wf.color,
                            color: "#fff",
                            fontSize: "0.75rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                          }}
                        >
                          {idx + 1}
                        </span>
                        <strong style={{ fontSize: "0.9rem", color: "var(--ink)" }}>{step.title}</strong>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--ink-soft)", lineHeight: 1.6 }}>
                        {step.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* تب ۲: دانشنامه و اصطلاحات تخصصی */}
      {activeTab === "encyclopedia" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "16px",
          }}
        >
          {filteredEncyclopedia.map((item, idx) => (
            <div
              key={idx}
              style={{
                background: "var(--panel)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--line)",
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                boxShadow: "var(--sh-1)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>
                  {item.term}
                </h3>
                <span
                  style={{
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {item.category}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--ink-soft)", lineHeight: 1.6 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* تب ۳: کلیدهای میانبر و راهنمای بصری وضعیت قطارها */}
      {activeTab === "shortcuts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* بخش نشان‌ها و کدهای رنگی دپو */}
          <div
            style={{
              background: "var(--panel)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--line)",
              padding: "20px",
              boxShadow: "var(--sh-1)",
            }}
          >
            <h3 style={{ margin: "0 0 14px", fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>
              🚦 راهنمای نشان‌ها و وضعیت‌های بصری در دپو
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "var(--panel-2)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                }}
              >
                <CheckCircle size={22} color="var(--good)" weight="bold" />
                <div>
                  <strong style={{ fontSize: "0.85rem", display: "block" }}>آماده به کار / استندبای</strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>سبز · آماده مانور و سرویس</span>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "var(--panel-2)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                }}
              >
                <Wrench size={22} color="var(--warn)" weight="bold" />
                <div>
                  <strong style={{ fontSize: "0.85rem", display: "block" }}>در اختیار تعمیرات</strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>نارنجی · در حال عیب‌یابی</span>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "var(--panel-2)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                }}
              >
                <Lightning size={22} color="var(--rail)" weight="bold" />
                <div>
                  <strong style={{ fontSize: "0.85rem", display: "block" }}>در حال اعزام</strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>آبی · خروج به سمت خط تجاری</span>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "var(--panel-2)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                }}
              >
                <Prohibit size={22} color="var(--crit)" weight="bold" />
                <div>
                  <strong style={{ fontSize: "0.85rem", display: "block" }}>غیرفعال / اسقاط</strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>قرمز · خارج از مدار عملیات</span>
                </div>
              </div>
            </div>
          </div>

          {/* جدول کلیدهای میانبر کیبورد */}
          <div
            style={{
              background: "var(--panel)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--line)",
              padding: "20px",
              boxShadow: "var(--sh-1)",
            }}
          >
            <h3 style={{ margin: "0 0 14px", fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>
              ⌨️ کلیدهای میانبر و کلیدهای سریع کیبورد
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {shortcuts.map((sc, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    background: "var(--panel-2)",
                    borderRadius: "8px",
                  }}
                >
                  <span style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{sc.desc}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <kbd
                      style={{
                        background: "var(--panel)",
                        border: "1px solid var(--line)",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        fontFamily: "var(--mono)",
                        fontWeight: 600,
                        boxShadow: "var(--sh-1)",
                      }}
                    >
                      {sc.key}
                    </kbd>
                    <button
                      onClick={() => handleCopy(sc.key, `sc-${idx}`)}
                      className="btn btn-ghost"
                      style={{ padding: "4px 8px", borderRadius: "6px" }}
                      title="کپی کلید"
                    >
                      {copiedKey === `sc-${idx}` ? <Check size={16} color="var(--good)" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* تب ۴: پرسش‌های متداول (FAQ) */}
      {activeTab === "faq" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredFaqs.map((faq, idx) => (
            <div
              key={idx}
              style={{
                background: "var(--panel)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--line)",
                padding: "18px",
                boxShadow: "var(--sh-1)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    color: "var(--accent)",
                    fontWeight: 800,
                    fontSize: "1.1rem",
                  }}
                >
                  ❓
                </span>
                <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>
                  {faq.q}
                </h3>
              </div>
              <p
                style={{
                  margin: "4px 0 0 28px",
                  fontSize: "0.85rem",
                  color: "var(--ink-soft)",
                  lineHeight: 1.65,
                }}
              >
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
