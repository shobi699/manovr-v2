"use client";

import React from "react";
import DataTable from "@/components/DataTable";
import LineRowActions from "./LineRowActions";
import { Terminal } from "@/lib/enums";
import { importLinesFromExcel } from "@/app/actions/line";
import { useToast } from "@/components/ui/Toast";

interface LookupValue {
  code: number;
  label: string;
}

interface LinesTableClientProps {
  lines: any[];
  terminals: LookupValue[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export default function LinesTableClient({ lines, terminals, canCreate, canEdit, canDelete }: LinesTableClientProps) {
  const [filterTerminal, setFilterTerminal] = React.useState<string>("all");
  const [filterType, setFilterType] = React.useState<string>("all");
  const [filterStatus, setFilterStatus] = React.useState<string>("all");
  const { toast } = useToast();

  const filteredLines = React.useMemo(() => {
    return lines.filter((l) => {
      if (filterTerminal !== "all" && String(l.terminal) !== filterTerminal) return false;
      if (filterType !== "all") {
        const isDyn = filterType === "dynamic";
        if (l.isDynamic !== isDyn) return false;
      }
      if (filterStatus !== "all") {
        const isActive = filterStatus === "active";
        const lineActive = l.isActive !== false;
        if (lineActive !== isActive) return false;
      }
      return true;
    });
  }, [lines, filterTerminal, filterType, filterStatus]);

  const handleExportExcel = async () => {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("لیست خطوط");
      worksheet.views = [{ rtl: true } as any];

      worksheet.columns = [
        { header: "نام خط", key: "name", width: 15 },
        { header: "تگ (Tag)", key: "tag", width: 15 },
        { header: "کد ترمینال", key: "terminal", width: 15 },
        { header: "نام ترمینال", key: "terminalLabel", width: 15 },
        { header: "ظرفیت پارک", key: "capacity", width: 15 },
        { header: "نوع خط (دینامیک/ثابت)", key: "isDynamic", width: 20 },
        { header: "موقعیت X", key: "posX", width: 15 },
        { header: "موقعیت Y", key: "posY", width: 15 },
        { header: "چرخش", key: "rotation", width: 15 },
        { header: "طول ریل", key: "length", width: 15 },
        { header: "وضعیت خط (فعال/مسدود)", key: "isActive", width: 20 },
      ];

      lines.forEach((l) => {
        worksheet.addRow({
          name: l.name,
          tag: l.tag || "",
          terminal: l.terminal,
          terminalLabel: terminals.find((t) => t.code === l.terminal)?.label || Terminal[l.terminal] || l.terminal,
          capacity: l.capacity,
          isDynamic: l.isDynamic ? "دینامیک" : "ثابت",
          posX: l.posX,
          posY: l.posY,
          rotation: l.rotation,
          length: l.length || 30,
          isActive: l.isActive !== false ? "فعال" : "مسدود",
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lines-list.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error("خطا در خروجی گرفتن اکسل.");
    }
  };

  const handleDownloadSample = async () => {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("نمونه ورود خطوط");
      worksheet.views = [{ rtl: true } as any];

      worksheet.columns = [
        { header: "نام خط *", key: "name", width: 15 },
        { header: "تگ (Tag)", key: "tag", width: 15 },
        { header: "ظرفیت پارک (عدد)", key: "capacity", width: 15 },
        { header: "کد ترمینال * (عدد ۱ تا ۷)", key: "terminalCode", width: 25 },
        { header: "دینامیک (0=ثابت، 1=دینامیک)", key: "isDynamic", width: 25 },
      ];

      worksheet.addRow({
        name: "خط ۱۰ دپو",
        tag: "L10",
        capacity: 4,
        terminalCode: 1,
        isDynamic: 0,
      });

      worksheet.addRow({
        name: "خط تعمیرات جک",
        tag: "L_JACK",
        capacity: 2,
        terminalCode: 2,
        isDynamic: 1,
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lines-sample.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error("خطا در تولید فایل نمونه اکسل.");
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
          
          const name = String(vals[1] || "").trim();
          if (!name) return;

          const tag = vals[2] ? String(vals[2]).trim() : undefined;
          const capacity = vals[3] !== undefined ? Number(vals[3]) : undefined;
          const terminalCode = vals[4] !== undefined ? Number(vals[4]) : undefined;
          const isDynamic = vals[5] !== undefined ? Number(vals[5]) === 1 : undefined;

          rows.push({
            name,
            tag,
            capacity,
            terminalCode,
            isDynamic,
          });
        });

        if (rows.length === 0) {
          toast.warning("هیچ داده معتبری در فایل پیدا نشد.");
          return;
        }

        const res = await importLinesFromExcel(rows);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(`تعداد ${res.count} خط جدید با موفقیت درج شدند.`);
          window.location.reload();
        }
      } catch (err) {
        console.error(err);
        toast.error("فرمت فایل اکسل معتبر نیست یا خطا در خواندن رخ داد.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const columns = [
    { key: "name", label: "نام خط", sortable: true },
    { key: "tag", label: "تگ (Tag)", sortable: true, render: (l: any) => l.tag ?? <span className="muted">—</span> },
    {
      key: "terminal",
      label: "ترمینال",
      sortable: true,
      render: (l: any) => (
        <span className="pill p-rail">
          {terminals.find((t) => t.code === l.terminal)?.label ?? Terminal[l.terminal] ?? l.terminal}
        </span>
      ),
    },
    { key: "capacity", label: "ظرفیت پارک", sortable: true, render: (l: any) => <span className="num">{l.capacity}</span> },
    {
      key: "isDynamic",
      label: "نوع خط",
      sortable: true,
      render: (l: any) => l.isDynamic ? <span className="pill p-warn">دینامیک</span> : <span className="muted">ثابت</span>,
    },
    { key: "posX", label: "موقعیت X", sortable: true, render: (l: any) => <span className="num">{l.posX.toFixed(1)}</span> },
    { key: "posY", label: "موقعیت Y (Z)", sortable: true, render: (l: any) => <span className="num">{l.posY.toFixed(1)}</span> },
    { key: "rotation", label: "چرخش (درجه)", sortable: true, render: (l: any) => <span className="num">{l.rotation}°</span> },
    {
      key: "isActive",
      label: "وضعیت",
      sortable: true,
      render: (l: any) => l.isActive !== false ? <span className="pill p-success">فعال</span> : <span className="pill p-danger">غیرفعال (مسدود)</span>,
    },
    ...((canEdit || canDelete)
      ? [
          {
            key: "actions",
            label: "عملیات",
            render: (l: any) => <LineRowActions id={l.id} canEdit={canEdit} canDelete={canDelete} />,
          },
        ]
      : []),
  ];

  return (
    <>
      {canCreate && (
        <div className="card" style={{ padding: "16px", marginBottom: "20px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--ink)" }}>عملیات گروهی اکسل:</span>
          
          <button onClick={handleExportExcel} className="btn primary sm" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "16px" }}>📥</span> خروجی اکسل خطوط
          </button>
          
          <label className="btn sm" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", margin: 0, padding: "8px 12px", border: "1px solid var(--line)" }}>
            <span style={{ fontSize: "16px" }}>📤</span> بارگذاری اکسل خطوط
            <input type="file" accept=".xlsx" onChange={handleExcelImport} style={{ display: "none" }} />
          </label>
          
          <button onClick={handleDownloadSample} className="btn sm" style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "transparent", border: "1px dashed var(--line)" }}>
            <span style={{ fontSize: "16px" }}>📄</span> دانلود نمونه اکسل ورودی
          </button>
        </div>
      )}

      {/* نوار فیلتر پیشرفته */}
      <div className="card" style={{ padding: "16px", marginBottom: "20px", background: "rgba(30, 41, 59, 0.02)", border: "1px solid var(--line-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
          <span style={{ fontSize: "18px" }}>🔍</span>
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "bold", color: "var(--ink)" }}>فیلترهای پیشرفته خطوط</h3>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", alignItems: "end" }}>
          {/* فیلتر ترمینال */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12px", color: "var(--ink-soft)", fontWeight: 600 }}>ترمینال / بخش پایانه:</label>
            <select
              value={filterTerminal}
              onChange={(e) => setFilterTerminal(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)", fontSize: "13px" }}
            >
              <option value="all">همه ترمینال‌ها</option>
              {terminals.map((t) => (
                <option key={t.code} value={String(t.code)}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* فیلتر نوع خط */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12px", color: "var(--ink-soft)", fontWeight: 600 }}>نوع خط ریل:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)", fontSize: "13px" }}
            >
              <option value="all">همه نوع‌ها (دینامیک و ثابت)</option>
              <option value="dynamic">دینامیک</option>
              <option value="static">ثابت</option>
            </select>
          </div>

          {/* فیلتر وضعیت خط */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12px", color: "var(--ink-soft)", fontWeight: 600 }}>وضعیت خط:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)", fontSize: "13px" }}
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="active">فعال</option>
              <option value="blocked">غیرفعال (مسدود)</option>
            </select>
          </div>

          {/* دکمه ریست */}
          {(filterTerminal !== "all" || filterType !== "all" || filterStatus !== "all") && (
            <div>
              <button
                onClick={() => {
                  setFilterTerminal("all");
                  setFilterType("all");
                  setFilterStatus("all");
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
        <h2>فهرست خطوط پایانه</h2>
        <span className="spacer" />
        <span className="pill p-mut">{filteredLines.length} خط</span>
      </div>
      <div style={{ marginTop: "14px" }}>
        <DataTable
          tableName="lines"
          columns={columns}
          data={filteredLines}
          searchPlaceholder="جستجو بر اساس نام خط یا تگ..."
          searchFields={["name", "tag"]}
        />
      </div>
    </div>
  </>
  );
}
