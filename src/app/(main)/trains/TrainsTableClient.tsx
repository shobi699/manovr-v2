"use client";

import React from "react";
import DataTable, { BulkAction } from "@/components/DataTable";
import TrainRowActions from "./TrainRowActions";
import { TrainType } from "@/lib/enums";

import { updateTrainStatus, importTrainsFromExcel, updateTrainFlags, bulkUpdateTrainStatus, bulkUpdateTrainFlags, bulkToggleTrainDisposed } from "@/app/actions/train";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface LookupValue {
  code: number;
  label: string;
  color?: string | null;
}

interface TrainsTableClientProps {
  trains: any[];
  trainTypes?: LookupValue[];
  canManage: boolean;
}

export default function TrainsTableClient({ trains, trainTypes = [], canManage }: TrainsTableClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const getTrainTypeLabel = (code: number) => {
    return trainTypes.find((v) => v.code === code)?.label || TrainType[code] || `نوع ${code}`;
  };

  const [filterType, setFilterType] = React.useState<string>("all");
  const [filterOpStatus, setFilterOpStatus] = React.useState<string>("all");
  const [filterLine, setFilterLine] = React.useState<string>("all");
  const [filterSystemStatus, setFilterSystemStatus] = React.useState<string>("all");
  const [filterTechnical, setFilterTechnical] = React.useState<string>("all");

  // استخراج تمام خطوط متمایز قطارها برای نمایش در دراپ‌داون فیلتر
  const uniqueLines = React.useMemo(() => {
    const linesMap = new Map<string, string>();
    trains.forEach((t) => {
      if (t.line) {
        linesMap.set(String(t.line.id), t.line.name);
      }
    });
    return Array.from(linesMap.entries()).map(([value, label]) => ({ value, label }));
  }, [trains]);

  const filteredTrains = React.useMemo(() => {
    return trains.filter((t) => {
      if (filterType !== "all" && String(t.type) !== filterType) return false;
      if (filterOpStatus !== "all" && String(t.status) !== filterOpStatus) return false;
      if (filterLine !== "all" && (!t.line || String(t.line.id) !== filterLine)) return false;
      if (filterSystemStatus !== "all") {
        const isDis = filterSystemStatus === "disposed";
        if (t.isDisposed !== isDis) return false;
      }
      if (filterTechnical !== "all") {
        if (filterTechnical === "hasKafshak" && !t.hasKafshak) return false;
        if (filterTechnical === "noAtp" && !t.noAtp) return false;
        if (filterTechnical === "movadDavvar" && !t.movadDavvar) return false;
        if (filterTechnical === "movadDavvarA" && t.movadDavvar !== "A") return false;
        if (filterTechnical === "movadDavvarB" && t.movadDavvar !== "B") return false;
        if (filterTechnical === "movadDavvarC" && t.movadDavvar !== "C") return false;
        if (filterTechnical === "noLicense" && !t.noLicense) return false;
      }
      return true;
    });
  }, [trains, filterType, filterOpStatus, filterLine, filterSystemStatus, filterTechnical]);

  const handleExportExcel = async () => {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("لیست قطارها");
      worksheet.views = [{ rtl: true } as any];

      worksheet.columns = [
        { header: "کد قطار", key: "code", width: 15 },
        { header: "نوع قطار", key: "type", width: 15 },
        { header: "خط جاری", key: "lineName", width: 15 },
        { header: "وضعیت عملیاتی", key: "status", width: 20 },
        { header: "کفشک", key: "hasKafshak", width: 12 },
        { header: "عدم ATP", key: "noAtp", width: 12 },
        { header: "موعد دوار", key: "movadDavvar", width: 12 },
        { header: "بدون مجوز", key: "noLicense", width: 12 },
        { header: "جایگاه پارک", key: "slotIndex", width: 15 },
        { header: "وضعیت سیستم", key: "isDisposed", width: 15 },
      ];

      trains.forEach((t) => {
        worksheet.addRow({
          code: t.code,
          type: getTrainTypeLabel(t.type),
          lineName: t.line?.name || "—",
          status: t.status === 2 ? "تعمیرات" : t.status === 3 ? "غیرفعال" : t.status === 4 ? "در حال اعزام" : "آماده",
          hasKafshak: t.hasKafshak ? "دارد" : "ندارد",
          noAtp: t.noAtp ? "عدم ATP" : "سالم",
          movadDavvar: t.movadDavvar ? `سطح ${t.movadDavvar}` : "—",
          noLicense: t.noLicense ? "بدون مجوز" : "دارای مجوز",
          slotIndex: t.slotIndex,
          isDisposed: t.isDisposed ? "غیرفعال" : "فعال",
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "trains-list.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("خطا در خروجی گرفتن اکسل.");
    }
  };

  const handleDownloadSample = async () => {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("نمونه ورود قطارها");
      worksheet.views = [{ rtl: true } as any];

      worksheet.columns = [
        { header: "کد قطار *", key: "code", width: 15 },
        { header: "نوع (0=AC، 1=DC، 2=دیزل)", key: "type", width: 25 },
        { header: "وضعیت (1=آماده، 2=تعمیرات، 3=غیرفعال، 4=اعزام)", key: "status", width: 35 },
        { header: "نام خط پارک (مطابق خطوط تعریف شده)", key: "lineName", width: 30 },
        { header: "جایگاه پارک (عدد)", key: "slotIndex", width: 15 },
      ];

      worksheet.addRow({
        code: "101",
        type: 0,
        status: 1,
        lineName: "خط ۱ دپو",
        slotIndex: 1,
      });

      worksheet.addRow({
        code: "201",
        type: 1,
        status: 2,
        lineName: "تعمیرگاه ۵",
        slotIndex: 3,
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "trains-sample.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("خطا در تولید فایل نمونه اکسل.");
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const ExcelJS = (await import("exceljs")).default;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const worksheet = workbook.worksheets[0];

        const rows: any[] = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const vals = Array.isArray(row.values) ? row.values : [];
          
          const code = String(vals[1] || "").trim();
          if (!code) return;

          const type = vals[2] !== undefined ? Number(vals[2]) : undefined;
          const status = vals[3] !== undefined ? Number(vals[3]) : undefined;
          const lineName = vals[4] ? String(vals[4]).trim() : undefined;
          const slotIndex = vals[5] !== undefined ? Number(vals[5]) : undefined;

          rows.push({
            code,
            type,
            status,
            lineName,
            slotIndex,
          });
        });

        if (rows.length === 0) {
          alert("هیچ داده معتبری در فایل پیدا نشد.");
          return;
        }

        const res = await importTrainsFromExcel(rows);
        if (res.error) {
          alert(res.error);
        } else {
          alert(`تعداد ${res.count} قطار جدید با موفقیت درج شدند.`);
          window.location.reload();
        }
      } catch (err) {
        console.error(err);
        alert("فرمت فایل اکسل معتبر نیست یا خطا در خواندن رخ داد.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const columns = [
    { key: "code", label: "کد قطار", sortable: true },
    {
      key: "type",
      label: "نوع قطار",
      sortable: true,
      render: (t: any) => (
        <span className={`pill ${t.type === 0 ? "p-rail" : "p-warn"}`}>
          {getTrainTypeLabel(t.type)}
        </span>
      ),
    },
    {
      key: "line",
      label: "خط جاری",
      sortable: true,
      render: (t: any) => t.line?.name ?? <span className="muted">—</span>,
    },
    {
      key: "opStatus",
      label: "وضعیت عملیاتی",
      sortable: true,
      render: (t: any) => {
        if (canManage) {
          return (
            <select
              value={t.status}
              className="input sm"
              style={{ padding: "4px 8px", fontSize: "12px", width: "140px", height: "32px" }}
              disabled={isPending}
              onChange={(e) => {
                const val = Number(e.target.value);
                startTransition(async () => {
                  const res = await updateTrainStatus(t.id, val);
                  if (res.error) {
                    alert(res.error);
                  } else {
                    router.refresh();
                  }
                });
              }}
            >
              <option value="1">🟢 آماده / استندبای</option>
              <option value="2">🛠️ تعمیرات</option>
              <option value="3">❌ غیرفعال</option>
              <option value="4">⚡ در حال اعزام</option>
            </select>
          );
        }

        return (
          <span style={{ fontSize: "12.5px", fontWeight: "600" }}>
            {t.status === 2 ? "🛠️ تعمیرات" :
             t.status === 3 ? "❌ غیرفعال" :
             t.status === 4 ? "⚡ در حال اعزام" : "🟢 آماده"}
          </span>
        );
      }
    },
    {
      key: "techStatus",
      label: "ویژگی‌ها و وضعیت فنی",
      render: (t: any) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
            {t.hasKafshak && (
              <span className="pill" style={{ backgroundColor: "#f59e0b", color: "#fff", fontSize: "11px", padding: "2px 6px" }}>
                ⚡ کفشک
              </span>
            )}
            {t.noAtp && (
              <span className="pill" style={{ backgroundColor: "#ef4444", color: "#fff", fontSize: "11px", padding: "2px 6px" }}>
                🚨 عدم ATP
              </span>
            )}
            {t.movadDavvar && (
              <span
                className="pill"
                style={{
                  backgroundColor: t.movadDavvar === "A" ? "#8b5cf6" : t.movadDavvar === "B" ? "#14b8a6" : "#f59e0b",
                  color: "#fff",
                  fontSize: "11px",
                  padding: "2px 6px"
                }}
              >
                🔄 دوار {t.movadDavvar}
              </span>
            )}
            {t.noLicense && (
              <span className="pill" style={{ backgroundColor: "#be123c", color: "#fff", fontSize: "11px", padding: "2px 6px" }}>
                🛑 بدون مجوز
              </span>
            )}
            {!t.hasKafshak && !t.noAtp && !t.movadDavvar && !t.noLicense && (
              <span className="muted" style={{ fontSize: "11px" }}>— عادی —</span>
            )}
          </div>

          {canManage && (
            <div style={{ display: "flex", gap: "4px", marginTop: "4px", flexWrap: "wrap" }}>
              <button
                type="button"
                className={`btn sm ${t.hasKafshak ? "accent" : ""}`}
                style={{ fontSize: "10px", padding: "1px 5px", height: "22px" }}
                title="تغییر وضعیت کفشک"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    await updateTrainFlags(t.id, { hasKafshak: !t.hasKafshak });
                    router.refresh();
                  });
                }}
              >
                {t.hasKafshak ? "⚡ کفشک دارد" : "⚡ بدون کفشک"}
              </button>
              <button
                type="button"
                className={`btn sm ${t.noAtp ? "danger" : ""}`}
                style={{ fontSize: "10px", padding: "1px 5px", height: "22px" }}
                title="تغییر وضعیت ATP"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    await updateTrainFlags(t.id, { noAtp: !t.noAtp });
                    router.refresh();
                  });
                }}
              >
                {t.noAtp ? "🚨 عدم ATP" : "✅ ATP دار"}
              </button>
              <select
                value={t.movadDavvar || ""}
                className="input sm"
                style={{ fontSize: "10px", padding: "1px 4px", height: "22px", width: "85px" }}
                disabled={isPending}
                onChange={(e) => {
                  const val = e.target.value || null;
                  startTransition(async () => {
                    await updateTrainFlags(t.id, { movadDavvar: val });
                    router.refresh();
                  });
                }}
              >
                <option value="">بدون دوّار</option>
                <option value="A">دوار A</option>
                <option value="B">دوار B</option>
                <option value="C">دوار C</option>
              </select>
              <button
                type="button"
                className={`btn sm ${t.noLicense ? "danger" : ""}`}
                style={{ fontSize: "10px", padding: "1px 5px", height: "22px" }}
                title="تغییر وضعیت مجوز"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    await updateTrainFlags(t.id, { noLicense: !t.noLicense });
                    router.refresh();
                  });
                }}
              >
                {t.noLicense ? "🛑 بدون مجوز" : "🟢 با مجوز"}
              </button>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: "وضعیت سیستم",
      sortable: true,
      render: (t: any) =>
        t.isDisposed ? (
          <span className="pill p-crit">غیرفعال</span>
        ) : (
          <span className="pill p-good">فعال</span>
        ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "عملیات",
            render: (t: any) => <TrainRowActions id={t.id} />,
          },
        ]
      : []),
  ];

  const trainBulkActions: BulkAction<any>[] = React.useMemo(() => {
    if (!canManage) return [];

    return [
      {
        key: "status_ready",
        label: "🟢 تغییر به آماده",
        onClick: async (items, clear) => {
          const ids = items.map((i) => i.id);
          const res = await bulkUpdateTrainStatus(ids, 1);
          if (res.error) alert(res.error);
          else {
            clear();
            router.refresh();
          }
        },
      },
      {
        key: "status_repair",
        label: "🛠️ تغییر به تعمیرات",
        variant: "warning",
        onClick: async (items, clear) => {
          const ids = items.map((i) => i.id);
          const res = await bulkUpdateTrainStatus(ids, 2);
          if (res.error) alert(res.error);
          else {
            clear();
            router.refresh();
          }
        },
      },
      {
        key: "status_inactive",
        label: "❌ تغییر به غیرفعال",
        variant: "danger",
        onClick: async (items, clear) => {
          const ids = items.map((i) => i.id);
          const res = await bulkUpdateTrainStatus(ids, 3);
          if (res.error) alert(res.error);
          else {
            clear();
            router.refresh();
          }
        },
      },
      {
        key: "flag_kafshak_toggle",
        label: "⚡ وجود کفشک",
        variant: "accent",
        onClick: async (items, clear) => {
          const ids = items.map((i) => i.id);
          const res = await bulkUpdateTrainFlags(ids, { hasKafshak: true });
          if (res.error) alert(res.error);
          else {
            clear();
            router.refresh();
          }
        },
      },
      {
        key: "flag_atp_toggle",
        label: "🚨 عدم ATP",
        variant: "danger",
        onClick: async (items, clear) => {
          const ids = items.map((i) => i.id);
          const res = await bulkUpdateTrainFlags(ids, { noAtp: true });
          if (res.error) alert(res.error);
          else {
            clear();
            router.refresh();
          }
        },
      },
      {
        key: "flag_davvar_a",
        label: "🔄 دوّار A",
        onClick: async (items, clear) => {
          const ids = items.map((i) => i.id);
          const res = await bulkUpdateTrainFlags(ids, { movadDavvar: "A" });
          if (res.error) alert(res.error);
          else {
            clear();
            router.refresh();
          }
        },
      },
      {
        key: "flag_license_toggle",
        label: "🛑 بدون مجوز",
        variant: "danger",
        onClick: async (items, clear) => {
          const ids = items.map((i) => i.id);
          const res = await bulkUpdateTrainFlags(ids, { noLicense: true });
          if (res.error) alert(res.error);
          else {
            clear();
            router.refresh();
          }
        },
      },
      {
        key: "dispose_toggle",
        label: "🚫 غیرفعال‌سازی سیستم",
        variant: "danger",
        onClick: async (items, clear) => {
          if (!confirm(`آیا از غیرفعال‌سازی سیستم برای ${items.length} قطار مطمئن هستید؟`)) return;
          const ids = items.map((i) => i.id);
          const res = await bulkToggleTrainDisposed(ids, true);
          if (res.error) alert(res.error);
          else {
            clear();
            router.refresh();
          }
        },
      },
    ];
  }, [canManage, router]);

  return (
    <>
      {canManage && (
        <div className="card" style={{ padding: "16px", marginBottom: "20px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--ink)" }}>عملیات اکسل و ثبت:</span>
          
          <button onClick={handleExportExcel} className="btn primary sm" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "16px" }}>📥</span> خروجی اکسل قطارها
          </button>
          
          <label className="btn sm" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", margin: 0, padding: "8px 12px", border: "1px solid var(--line)" }}>
            <span style={{ fontSize: "16px" }}>📤</span> بارگذاری اکسل قطارها
            <input type="file" accept=".xlsx" onChange={handleExcelImport} style={{ display: "none" }} />
          </label>
          
          <button onClick={handleDownloadSample} className="btn sm" style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "transparent", border: "1px dashed var(--line)" }}>
            <span style={{ fontSize: "16px" }}>📄</span> دانلود نمونه اکسل ورودی
          </button>

          <span className="spacer" />
          <button onClick={() => router.push("/trains/new")} className="btn accent sm">
            ➕ ثبت قطار جدید
          </button>
        </div>
      )}

      {/* نوار فیلتر پیشرفته */}
      <div className="card" style={{ padding: "16px", marginBottom: "20px", background: "rgba(30, 41, 59, 0.02)", border: "1px solid var(--line-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
          <span style={{ fontSize: "18px" }}>🔍</span>
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "bold", color: "var(--ink)" }}>فیلترهای پیشرفته قطارها</h3>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", alignItems: "end" }}>
          {/* فیلتر نوع قطار */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12px", color: "var(--ink-soft)", fontWeight: 600 }}>نوع قطار:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)", fontSize: "13px" }}
            >
              <option value="all">همه نوع‌ها</option>
              {trainTypes && trainTypes.length > 0
                ? trainTypes.map((t) => (
                    <option key={t.code} value={String(t.code)}>{t.label}</option>
                  ))
                : Object.entries(TrainType).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))
              }
            </select>
          </div>

          {/* فیلتر وضعیت عملیاتی */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12px", color: "var(--ink-soft)", fontWeight: 600 }}>وضعیت عملیاتی:</label>
            <select
              value={filterOpStatus}
              onChange={(e) => setFilterOpStatus(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)", fontSize: "13px" }}
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="1">🟢 آماده / استندبای</option>
              <option value="2">🛠️ تعمیرات</option>
              <option value="3">❌ غیرفعال</option>
              <option value="4">⚡ در حال اعزام</option>
            </select>
          </div>

          {/* فیلتر خط پارک قطار */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12px", color: "var(--ink-soft)", fontWeight: 600 }}>خط پارک ریل:</label>
            <select
              value={filterLine}
              onChange={(e) => setFilterLine(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)", fontSize: "13px" }}
            >
              <option value="all">همه خطوط</option>
              {uniqueLines.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* فیلتر وضعیت سیستم */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12px", color: "var(--ink-soft)", fontWeight: 600 }}>وضعیت در سیستم:</label>
            <select
              value={filterSystemStatus}
              onChange={(e) => setFilterSystemStatus(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)", fontSize: "13px" }}
            >
              <option value="all">همه</option>
              <option value="active">فعال</option>
              <option value="disposed">غیرفعال</option>
            </select>
          </div>

          {/* فیلتر وضعیت فنی و ویژگی‌ها */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12px", color: "var(--ink-soft)", fontWeight: 600 }}>وضعیت فنی و ویژگی‌ها:</label>
            <select
              value={filterTechnical}
              onChange={(e) => setFilterTechnical(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)", fontSize: "13px" }}
            >
              <option value="all">همه وضعیت‌های فنی</option>
              <option value="hasKafshak">⚡ دارای کفشک</option>
              <option value="noAtp">🚨 عدم ATP</option>
              <option value="movadDavvar">🔄 دارای موعد دوّار (کل)</option>
              <option value="movadDavvarA">🔄 موعد دوّار - سطح A</option>
              <option value="movadDavvarB">🔄 موعد دوّار - سطح B</option>
              <option value="movadDavvarC">🔄 موعد دوّار - سطح C</option>
              <option value="noLicense">🛑 بدون مجوز حرکت</option>
            </select>
          </div>

          {/* دکمه ریست */}
          {(filterType !== "all" || filterOpStatus !== "all" || filterLine !== "all" || filterSystemStatus !== "all" || filterTechnical !== "all") && (
            <div>
              <button
                onClick={() => {
                  setFilterType("all");
                  setFilterOpStatus("all");
                  setFilterLine("all");
                  setFilterSystemStatus("all");
                  setFilterTechnical("all");
                }}
                className="btn"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: "12px",
                  background: "transparent",
                  border: "1px solid var(--crit-soft)",
                  color: "var(--crit)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
              >
                ❌ پاک کردن فیلترها
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: "16px" }}>
        <div className="card-head" style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--line)" }}>
          <h2>فهرست قطارها</h2>
          <span className="spacer" />
          <span className="pill p-mut">{filteredTrains.length}</span>
        </div>
        <div style={{ marginTop: "14px" }}>
          <DataTable
            tableName="trains"
            columns={columns}
            data={filteredTrains}
            searchPlaceholder="جستجو بر اساس کد قطار..."
            searchFields={["code"]}
            bulkActions={trainBulkActions}
          />
        </div>
      </div>
    </>
  );
}
