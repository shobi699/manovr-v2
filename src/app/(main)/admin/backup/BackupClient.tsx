"use client";

import React, { useState, useTransition } from "react";
import { triggerManualBackup, triggerSourceCodeBackup, deleteBackup, updateBackupSettings, restoreDatabaseAction } from "@/app/actions/backup";
import DataTable, { Column } from "@/components/DataTable";

interface BackupRecord {
  id: number;
  filename: string;
  fileSize: number;
  backupType: string;
  schedule: string | null;
  createdAt: Date | string;
  dbExists: boolean;
  appExists: boolean;
}

interface BackupSettings {
  isEnabled: boolean;
  schedule: "daily" | "weekly" | "monthly";
  time: string;
}

export default function BackupClient({
  initialBackups,
  initialSettings,
  userRole,
}: {
  initialBackups: BackupRecord[];
  initialSettings: BackupSettings;
  userRole: number;
}) {
  const [backups, setBackups] = useState<BackupRecord[]>(initialBackups);
  const [settings, setSettings] = useState<BackupSettings>(initialSettings);
  const [isPending, startTransition] = useTransition();
  const [isBackupPending, setIsBackupPending] = useState(false);
  const [isCodeBackupPending, setIsCodeBackupPending] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState<number | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreConfirmText, setRestoreConfirmText] = useState("");
  const [mathAns, setMathAns] = useState("");
  const [mathQuestion, setMathQuestion] = useState({ num1: 0, num2: 0 });
  const [isRestorePending, setIsRestorePending] = useState(false);

  const isSuperAdmin = userRole === 4;

  const openRestoreModal = (backupId: number | null) => {
    setSelectedBackupId(backupId);
    const n1 = Math.floor(Math.random() * 9) + 2;
    const n2 = Math.floor(Math.random() * 9) + 2;
    setMathQuestion({ num1: n1, num2: n2 });
    setRestorePassword("");
    setRestoreConfirmText("");
    setMathAns("");
    setShowRestoreModal(true);
  };

  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (restoreConfirmText !== "تایید بازگردانی") {
      alert("لطفاً عبارت تاییدیه را دقیقاً وارد نمایید.");
      return;
    }
    
    if (Number(mathAns) !== mathQuestion.num1 + mathQuestion.num2) {
      alert("پاسخ سوال ریاضی نادرست است.");
      return;
    }

    if (!restorePassword) {
      alert("رمز عبور سوپرادمین الزامی است.");
      return;
    }

    if (selectedBackupId === null && !uploadedFile) {
      alert("هیچ فایلی برای بازگردانی مشخص نشده است.");
      return;
    }

    const formData = new FormData();
    formData.append("password", restorePassword);
    formData.append("confirmText", restoreConfirmText);
    formData.append("mathNum1", String(mathQuestion.num1));
    formData.append("mathNum2", String(mathQuestion.num2));
    formData.append("mathAns", mathAns);
    
    if (selectedBackupId !== null) {
      formData.append("backupId", String(selectedBackupId));
    } else if (uploadedFile) {
      formData.append("dbFile", uploadedFile);
    }

    setIsRestorePending(true);
    try {
      const res = await restoreDatabaseAction(formData);
      if (res.error) {
        alert(res.error);
      } else {
        alert("دیتابیس با موفقیت بازگردانی شد! سیستم بارگذاری مجدد می‌شود.");
        setShowRestoreModal(false);
        setUploadedFile(null);
        window.location.reload();
      }
    } catch {
      alert("خطایی در سرور رخ داد.");
    } finally {
      setIsRestorePending(false);
    }
  };

  const handleUploadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".db")) {
      alert("فرمت فایل نامعتبر است. فقط فایل‌های با پسوند db. مجاز هستند.");
      e.target.value = "";
      return;
    }

    setUploadedFile(file);
  };

  // فرمت حجم فایل
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "۰ بایت";
    const k = 1024;
    const sizes = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
    return val.toLocaleString("fa-IR") + " " + sizes[i];
  };

  // فرمت تاریخ جلالی
  const formatDate = (dateStr: Date | string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      calendar: "persian",
      timeZone: "Asia/Tehran",
    });
  };

  // ذخیره تنظیمات خودکار دیتابیس
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateBackupSettings(settings);
      if (res.error) {
        alert(res.error);
      } else {
        alert("تنظیمات زمان‌بندی پشتیبان‌گیری با موفقیت ذخیره شد.");
      }
    });
  };

  // ایجاد پشتیبان دستی دیتابیس
  const handleCreateDbBackup = async () => {
    setIsBackupPending(true);
    try {
      const res = await triggerManualBackup();
      if (res.error) {
        alert(res.error);
      } else {
        alert("نسخه پشتیبان دیتابیس با موفقیت ایجاد شد.");
        window.location.reload();
      }
    } catch {
      alert("خطایی در سرور رخ داد.");
    } finally {
      setIsBackupPending(false);
    }
  };

  // ایجاد پشتیبان دستی سورس‌کد (فقط سوپرادمین)
  const handleCreateCodeBackup = async () => {
    setIsCodeBackupPending(true);
    try {
      const res = await triggerSourceCodeBackup();
      if (res.error) {
        alert(res.error);
      } else {
        alert("نسخه پشتیبان سورس‌کد با موفقیت ایجاد شد.");
        window.location.reload();
      }
    } catch {
      alert("خطایی در سرور رخ داد.");
    } finally {
      setIsCodeBackupPending(false);
    }
  };

  // حذف پشتیبان
  const handleDelete = async (id: number) => {
    if (!confirm("آیا از حذف فیزیکی این نسخه پشتیبان مطمئن هستید؟ این عمل غیرقابل بازگشت است.")) return;

    const res = await deleteBackup(id);
    if (res.error) {
      alert(res.error);
    } else {
      setBackups((prev) => prev.filter((b) => b.id !== id));
      alert("نسخه پشتیبان با موفقیت حذف شد.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* ردیف بالا: تنظیمات خودکار و عملیات دستی */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
        
        {/* کارت تنظیمات زمان‌بندی دیتابیس */}
        <div className="card" style={{ padding: "20px" }}>
          <div className="card-head" style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--line)" }}>
            <h2>🗓️ زمان‌بندی پشتیبان‌گیری خودکار دیتابیس</h2>
          </div>
          <form onSubmit={handleSaveSettings} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
            
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="checkbox"
                id="isEnabled"
                checked={settings.isEnabled}
                onChange={(e) => setSettings({ ...settings, isEnabled: e.target.checked })}
                style={{ width: "18px", height: "18px", accentColor: "var(--accent)" }}
              />
              <label htmlFor="isEnabled" style={{ fontWeight: 650, fontSize: "14px", cursor: "pointer" }}>
                فعال‌سازی پشتیبان‌گیری دوره‌ای دیتابیس
              </label>
            </div>

            {settings.isEnabled && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "13px", color: "var(--ink-soft)" }}>دوره پشتیبان‌گیری:</label>
                  <select
                    value={settings.schedule}
                    onChange={(e) => setSettings({ ...settings, schedule: e.target.value as any })}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)" }}
                  >
                    <option value="daily">روزانه (هر شب)</option>
                    <option value="weekly">هفتگی (هر جمعه شب)</option>
                    <option value="monthly">ماهانه (اول هر ماه)</option>
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "13px", color: "var(--ink-soft)" }}>ساعت اجرای پشتیبان‌گیری:</label>
                  <input
                    type="time"
                    value={settings.time}
                    onChange={(e) => setSettings({ ...settings, time: e.target.value })}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)" }}
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="btn primary"
              style={{ marginTop: "8px", width: "100%", justifyContent: "center" }}
            >
              {isPending ? "در حال ذخیره..." : "ذخیره تنظیمات زمان‌بندی"}
            </button>
          </form>
        </div>

        {/* کارت پشتیبان‌گیری دستی */}
        <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div className="card-head" style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--line)" }}>
              <h2>⚡ عملیات پشتیبان‌گیری دستی</h2>
            </div>
            <p style={{ fontSize: "13px", color: "var(--ink-soft)", lineHeight: 1.8, marginTop: "16px" }}>
              از این بخش می‌توانید نسخه‌های پشتیبان دیتابیس و کدهای برنامه را به صورت دستی تهیه و ذخیره نمایید.
              <br />
              - <strong>پشتیبان دیتابیس</strong> شامل کلیه اطلاعات ثبت‌شده دیتابیس است و برای تمامی مدیران در دسترس است.
              {isSuperAdmin && (
                <>
                  <br />
                  - <strong>پشتیبان سورس‌کد</strong> شامل کدها و فایل‌های ساختاری برنامه است و فقط و منحصراً برای <strong>سوپرادمین</strong> مجاز می‌باشد.
                </>
              )}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>
            <button
              onClick={handleCreateDbBackup}
              disabled={isBackupPending}
              className="btn primary"
              style={{ width: "100%", padding: "10px", justifyContent: "center", fontSize: "13px", gap: "6px" }}
            >
              {isBackupPending ? "در حال پشتیبان‌گیری دیتابیس..." : "🔄 ایجاد پشتیبان دیتابیس (SQLite)"}
            </button>

            {isSuperAdmin && (
              <button
                onClick={handleCreateCodeBackup}
                disabled={isCodeBackupPending}
                className="btn"
                style={{ width: "100%", padding: "10px", justifyContent: "center", fontSize: "13px", gap: "6px", border: "1px solid var(--accent)", color: "var(--accent)" }}
              >
                {isCodeBackupPending ? "در حال پشتیبان‌گیری سورس‌کد..." : "📦 ایجاد پشتیبان سورس‌کد (ZIP)"}
              </button>
            )}
          </div>
        </div>

        {/* کارت بازگردانی دیتابیس از فایل محلی (فقط سوپرادمین) */}
        {isSuperAdmin && (
          <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div className="card-head" style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--line)" }}>
                <h2>📂 بازگردانی دیتابیس از فایل محلی</h2>
              </div>
              <p style={{ fontSize: "13px", color: "var(--ink-soft)", lineHeight: 1.8, marginTop: "16px" }}>
                اگر قبلاً یک فایل پشتیبان با پسوند <code>.db</code> دانلود کرده‌اید، می‌توانید آن را در اینجا آپلود و بازگردانی کنید.
                <br />
                <span style={{ color: "var(--crit)", fontWeight: "bold" }}>⚠️ هشدار: این عملیات دیتابیس فعلی را کاملاً رونویسی خواهد کرد.</span>
              </p>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>
              <input
                type="file"
                accept=".db"
                onChange={handleUploadFileChange}
                style={{
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  background: "var(--panel)",
                  fontSize: "12px",
                  width: "100%",
                }}
              />
              {uploadedFile && (
                <button
                  onClick={() => openRestoreModal(null)}
                  className="btn"
                  style={{
                    width: "100%",
                    padding: "10px",
                    justifyContent: "center",
                    fontSize: "13px",
                    gap: "6px",
                    backgroundColor: "var(--crit-soft)",
                    color: "var(--crit)",
                    border: "1px solid var(--crit)",
                  }}
                >
                  🚀 شروع بازگردانی فایل آپلود شده
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* لیست فایل‌های بکاپ */}
      <div className="card" style={{ padding: "20px" }}>
        <div className="card-head" style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--line)" }}>
          <h2>📦 آرشیو فایل‌های پشتیبان سیستم</h2>
          <span className="spacer" />
          <span className="pill p-mut">{backups.length} نسخه</span>
        </div>

        <div style={{ marginTop: "16px", overflowX: "auto" }}>
          {backups.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--ink-soft)" }}>
              <span style={{ fontSize: "36px" }}>📂</span>
              <p style={{ marginTop: "8px", fontSize: "14px" }}>هیچ فایل پشتیبانی ثبت نشده است.</p>
            </div>
          ) : (
            <DataTable
              tableName="adminBackups"
              columns={[
                { key: "id", label: "شناسه", sortable: true, filterable: true, render: (b) => <span style={{ fontFamily: "var(--mono)" }}>{b.id}</span> },
                { key: "createdAt", label: "تاریخ و زمان ایجاد", sortable: true, filterable: true, getValue: (b) => formatDate(b.createdAt), render: (b) => formatDate(b.createdAt) },
                { 
                  key: "backupType", 
                  label: "نوع پشتیبان", 
                  filterable: true,
                  getValue: (b) => {
                    const isCodeType = b.backupType === "source_code";
                    return isCodeType ? "سورس‌کد" : b.backupType === "manual" ? "دستی (دیتابیس)" : `خودکار (${b.schedule === "daily" ? "روزانه" : b.schedule === "weekly" ? "هفتگی" : "ماهانه"})`;
                  },
                  render: (b) => {
                    const isCodeType = b.backupType === "source_code";
                    if (isCodeType) return <span className="pill" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent-ink)", fontSize: "11px" }}>سورس‌کد</span>;
                    if (b.backupType === "manual") return <span className="pill p-info" style={{ fontSize: "11px" }}>دستی (دیتابیس)</span>;
                    return <span className="pill p-good" style={{ fontSize: "11px" }}>خودکار ({b.schedule === "daily" ? "روزانه" : b.schedule === "weekly" ? "هفتگی" : "ماهانه"})</span>;
                  }
                },
                { key: "fileSize", label: "حجم فایل", sortable: true, getValue: (b) => b.fileSize, render: (b) => formatBytes(b.fileSize) },
                {
                  key: "status",
                  label: "وضعیت روی دیسک",
                  filterable: true,
                  getValue: (b) => {
                    const isCodeType = b.backupType === "source_code";
                    if (isCodeType) return b.appExists ? "سورس‌کد: موجود ✅" : "سورس‌کد: حذف‌شده ❌";
                    return b.dbExists ? "دیتابیس: موجود ✅" : "دیتابیس: حذف‌شده ❌";
                  },
                  render: (b) => {
                    const isCodeType = b.backupType === "source_code";
                    if (isCodeType) return <span className={`pill ${b.appExists ? "p-good" : "p-crit"}`} style={{ fontSize: "11px" }}>سورس‌کد: {b.appExists ? "موجود ✅" : "حذف‌شده ❌"}</span>;
                    return <span className={`pill ${b.dbExists ? "p-good" : "p-crit"}`} style={{ fontSize: "11px" }}>دیتابیس: {b.dbExists ? "موجود ✅" : "حذف‌شده ❌"}</span>;
                  }
                },
                {
                  key: "actions",
                  label: "دانلود و عملیات",
                  render: (b) => {
                    const isCodeType = b.backupType === "source_code";
                    return (
                      <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                        {!isCodeType && (
                          <a
                            href={b.dbExists ? `/api/admin/backups?id=${b.id}&type=db` : "#"}
                            onClick={(e) => !b.dbExists && e.preventDefault()}
                            className={`btn sm ${b.dbExists ? "" : "disabled"}`}
                            style={{ padding: "4px 8px", fontSize: "11px", backgroundColor: "var(--rail-soft)", color: "var(--rail)", opacity: b.dbExists ? 1 : 0.5 }}
                            title="دانلود فایل دیتابیس sqlite"
                          >
                            📥 دانلود دیتابیس
                          </a>
                        )}
                        {!isCodeType && isSuperAdmin && b.dbExists && (
                          <button
                            onClick={() => openRestoreModal(b.id)}
                            className="btn sm"
                            style={{ padding: "4px 8px", fontSize: "11px", backgroundColor: "var(--warn-soft)", color: "var(--warn)", border: "none" }}
                            title="بازگردانی دیتابیس سیستم به این نسخه"
                          >
                            ⏪ بازگردانی دیتابیس
                          </button>
                        )}
                        {isCodeType && isSuperAdmin && (
                          <a
                            href={b.appExists ? `/api/admin/backups?id=${b.id}&type=app` : "#"}
                            onClick={(e) => !b.appExists && e.preventDefault()}
                            className={`btn sm ${b.appExists ? "" : "disabled"}`}
                            style={{ padding: "4px 8px", fontSize: "11px", backgroundColor: "var(--accent-soft)", color: "var(--accent)", opacity: b.appExists ? 1 : 0.5 }}
                            title="دانلود سورس کد zip"
                          >
                            📦 دانلود سورس‌کد
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(b.id)}
                          className="btn sm"
                          style={{ padding: "4px 8px", fontSize: "11px", border: "1px solid var(--crit)", color: "var(--crit)", background: "transparent" }}
                        >
                          🗑️ حذف
                        </button>
                      </div>
                    );
                  }
                }
              ]}
              data={backups}
            />
          )}
        </div>
      </div>

      {/* مدال تایید امنیتی بازگردانی دیتابیس */}
      {showRestoreModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "500px",
              padding: "24px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)",
              border: "1px solid var(--crit-soft)",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              background: "var(--panel)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--crit)", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
              <span style={{ fontSize: "24px" }}>⚠️</span>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>تاییدیه امنیتی بازگردانی دیتابیس</h3>
            </div>

            <div style={{ backgroundColor: "var(--crit-soft)", color: "var(--crit)", padding: "12px", borderRadius: "6px", fontSize: "13px", lineHeight: 1.8 }}>
              <strong>توجه بسیار مهم:</strong> با انجام این عملیات، کل اطلاعات فعلی دیتابیس سیستم حذف شده و اطلاعات نسخه پشتیبان جایگزین خواهد شد. این عمل غیرقابل برگشت است.
              {selectedBackupId !== null ? (
                <div style={{ marginTop: "6px" }}>شناسه نسخه پشتیبان انتخابی: <strong style={{ fontFamily: "var(--mono)" }}>{selectedBackupId}</strong></div>
              ) : (
                <div style={{ marginTop: "6px" }}>منبع بازگردانی: <strong>فایل آپلود شده ({uploadedFile?.name})</strong></div>
              )}
            </div>

            <form onSubmit={handleRestoreSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* رمز عبور */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="restore-password" style={{ fontSize: "13px", fontWeight: 650 }}>
                  🔑 رمز عبور سوپرادمین جهت تایید هویت:
                </label>
                <input
                  type="password"
                  id="restore-password"
                  required
                  value={restorePassword}
                  onChange={(e) => setRestorePassword(e.target.value)}
                  className="input"
                  style={{ direction: "ltr", textAlign: "left" }}
                  placeholder="رمز عبور خود را وارد کنید"
                />
              </div>

              {/* سوال ریاضی */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="restore-math" style={{ fontSize: "13px", fontWeight: 650 }}>
                  🤖 سوال امنیتی (ضد ربات و خطا):
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "bold", direction: "ltr", display: "inline-block" }}>
                    {mathQuestion.num1} + {mathQuestion.num2} = ?
                  </span>
                  <input
                    type="number"
                    id="restore-math"
                    required
                    value={mathAns}
                    onChange={(e) => setMathAns(e.target.value)}
                    className="input"
                    style={{ flex: 1, direction: "ltr", textAlign: "center" }}
                    placeholder="پاسخ عددی"
                  />
                </div>
              </div>

              {/* کلمه تاییدیه */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="restore-confirm-text" style={{ fontSize: "13px", fontWeight: 650 }}>
                  ✍️ عبارت تاییدیه (عبارت <strong style={{ color: "var(--crit)" }}>"تایید بازگردانی"</strong> را تایپ کنید):
                </label>
                <input
                  type="text"
                  id="restore-confirm-text"
                  required
                  value={restoreConfirmText}
                  onChange={(e) => setRestoreConfirmText(e.target.value)}
                  className="input"
                  placeholder='تایید بازگردانی'
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowRestoreModal(false)}
                  className="btn"
                  style={{ border: "1px solid var(--line)", background: "transparent" }}
                  disabled={isRestorePending}
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="btn"
                  style={{
                    backgroundColor: "var(--crit)",
                    color: "#fff",
                    border: "none",
                  }}
                  disabled={isRestorePending}
                >
                  {isRestorePending ? "در حال بازگردانی..." : "💥 تایید و اجرای نهایی بازگردانی"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
