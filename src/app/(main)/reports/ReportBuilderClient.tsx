"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import { runDynamicReport, saveReportAction, deleteSavedReportAction } from "@/app/actions/report";
import { type ReportConfig, type ReportFilter } from "@/lib/report-engine";
import { createScheduledReport, toggleScheduledReport, deleteScheduledReport } from "@/app/actions/scheduled-report";
import { importPersonnelFromExcel } from "@/app/actions/user";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { ManovrType, ManovrStatus, ConfirmationStatus, TrainType, Terminal, Shift, OrgPosition, PersonnelType } from "@/lib/enums";
import ExcelJS from "exceljs";
import JalaliDateTimePicker from "@/components/JalaliDateTimePicker";

const CHART_COLORS = ["#1f3a5f", "#d8842a", "#2e7d5b", "#b23b3b", "#6d28d9", "#4b5563"];

const ENTITY_FIELDS: Record<string, { key: string; label: string }[]> = {
  manovr: [
    { key: "id", label: "شناسه مانور" },
    { key: "type", label: "نوع مانور" },
    { key: "status", label: "وضعیت اجرا" },
    { key: "confirmationStatus", label: "وضعیت تایید" },
    { key: "sourceLine", label: "خط مبدأ" },
    { key: "destinationLine", label: "خط مقصد" },
    { key: "train", label: "قطار" },
    { key: "rahbar1", label: "راهبر ۱" },
    { key: "rahbar2", label: "راهبر ۲" },
    { key: "creator", label: "کاربر ثبت‌کننده" },
    { key: "createdAt", label: "زمان ثبت" },
    { key: "finishedAt", label: "زمان اتمام" },
    { key: "executionTime", label: "زمان اجرای واقعی" },
    { key: "description", label: "توضیحات" },
  ],
  train: [
    { key: "code", label: "کد قطار" },
    { key: "type", label: "نوع قطار" },
    { key: "line", label: "خط جاری" },
    { key: "slotIndex", label: "اسلات پارک" },
    { key: "isDisposed", label: "وضعیت قطار" },
  ],
  line: [
    { key: "name", label: "نام خط" },
    { key: "tag", label: "تگ (Tag)" },
    { key: "capacity", label: "ظرفیت" },
    { key: "terminal", label: "ترمینال" },
    { key: "isDynamic", label: "نوع خط" },
    { key: "posX", label: "موقعیت X" },
    { key: "posY", label: "موقعیت Y" },
    { key: "rotation", label: "چرخش" },
    { key: "length", label: "طول ریل" },
  ],
  personnel: [
    { key: "firstName", label: "نام" },
    { key: "lastName", label: "نام خانوادگی" },
    { key: "userName", label: "نام کاربری" },
    { key: "phone1", label: "همراه ۱" },
    { key: "phone2", label: "همراه ۲" },
    { key: "internalTel", label: "تلفن داخلی" },
    { key: "address", label: "آدرس" },
    { key: "shift", label: "شیفت" },
    { key: "orgPosition", label: "سمت" },
    { key: "personnelType", label: "نوع پرسنل" },
    { key: "personnelCode", label: "کد پرسنلی" },
  ],
};

const OPERATORS = [
  { key: "equals", label: "مساوی" },
  { key: "notEquals", label: "نامساوی" },
  { key: "contains", label: "شامل متن" },
  { key: "gt", label: "بزرگتر از" },
  { key: "lt", label: "کوچکتر از" },
  { key: "between", label: "بازه بین" },
];

export default function ReportBuilderClient({
  userId,
  initialSavedReports,
  initialScheduledReports,
  lines,
  trains,
  personnel,
  canImport,
}: {
  userId: number;
  initialSavedReports: any[];
  initialScheduledReports: any[];
  lines: any[];
  trains: any[];
  personnel: any[];
  canImport: boolean;
}) {
  const [savedReports, setSavedReports] = useState(initialSavedReports);
  const [scheduledReports, setScheduledReports] = useState(initialScheduledReports);
  const [reportName, setReportName] = useState("");
  const [isPending, startTransition] = useTransition();

  // وضعیت‌های مربوط به زمان‌بندی گزارش
  const [selectedReportToSchedule, setSelectedReportToSchedule] = useState<any | null>(null);
  const [cron, setCron] = useState("0 8 * * *");
  const [format, setFormat] = useState("excel");
  const [recipients, setRecipients] = useState(String(userId));
  const [outputDir, setOutputDir] = useState("");
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // کانفیگ جاری گزارش‌ساز
  const [entity, setEntity] = useState<"manovr" | "train" | "line" | "personnel">("manovr");
  const [fields, setFields] = useState<string[]>(["id", "type", "train", "createdAt", "status"]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [groupBy, setGroupBy] = useState<string>("");
  const [chart, setChart] = useState<"table" | "bar" | "pie" | "line">("table");
  const [sortField, setSortField] = useState<string>("id");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [records, setRecords] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ایمپورت اکسل
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importCount, setImportCount] = useState<number | null>(null);

  // مدیریت تب‌های گزارش‌های پیش‌فرض
  const [activeReportTab, setActiveReportTab] = useState<string>("history");
  const [queryTrigger, setQueryTrigger] = useState(0);

  // فیلترهای پیشرفته تاریخچه مانورها (Maneuver History Filters)
  const [historyFromDate, setHistoryFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  });
  const [historyToDate, setHistoryToDate] = useState<string>(() => new Date().toISOString());
  const [historyType, setHistoryType] = useState<string>("");
  const [historyTrainId, setHistoryTrainId] = useState<string>("");
  const [historySourceLineId, setHistorySourceLineId] = useState<string>("");
  const [historyDestLineId, setHistoryDestLineId] = useState<string>("");

  // فیلترهای پیشرفته عملکرد راهبران (Personnel Performance Filters)
  const [rahbarName, setRahbarName] = useState<string>("");
  const [rahbarShift, setRahbarShift] = useState<string>("");
  const [rahbarFromDate, setRahbarFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  });
  const [rahbarToDate, setRahbarToDate] = useState<string>(() => new Date().toISOString());
  const [rahbarIsToday, setRahbarIsToday] = useState<boolean>(false);

  // واچر برای اعمال زنده فیلترهای تاریخچه مانورها، قطارهای بادگیری شده و مثلث شده
  useEffect(() => {
    if (activeReportTab === "history" || activeReportTab === "triangulated" || activeReportTab === "air_charged") {
      const activeFilters: ReportFilter[] = [];

      if (activeReportTab === "triangulated") {
        activeFilters.push({ field: "type", operator: "equals", value: "3" });
      } else if (activeReportTab === "air_charged") {
        activeFilters.push({ field: "type", operator: "equals", value: "11" });
      } else if (historyType) {
        activeFilters.push({ field: "type", operator: "equals", value: historyType });
      }

      if (historyFromDate && historyToDate) {
        const start = new Date(historyFromDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(historyToDate);
        end.setHours(23, 59, 59, 999);
        activeFilters.push({
          field: "executionTime",
          operator: "between",
          value: start.toISOString(),
          value2: end.toISOString()
        });
      } else if (historyFromDate) {
        activeFilters.push({ field: "executionTime", operator: "gt", value: new Date(historyFromDate).toISOString() });
      } else if (historyToDate) {
        activeFilters.push({ field: "executionTime", operator: "lt", value: new Date(historyToDate).toISOString() });
      }

      if (historyTrainId) {
        activeFilters.push({ field: "trainId", operator: "equals", value: historyTrainId });
      }
      if (historySourceLineId) {
        activeFilters.push({ field: "sourceLineId", operator: "equals", value: historySourceLineId });
      }
      if (historyDestLineId) {
        activeFilters.push({ field: "destinationLineId", operator: "equals", value: historyDestLineId });
      }

      setFilters(activeFilters);
      setQueryTrigger((prev) => prev + 1);
    }
  }, [activeReportTab, historyFromDate, historyToDate, historyType, historyTrainId, historySourceLineId, historyDestLineId]);

  // واچر برای اعمال زنده عملکرد راهبران
  useEffect(() => {
    if (activeReportTab === "rahbaran") {
      const activeFilters: ReportFilter[] = [];

      let fromStr = rahbarFromDate;
      let toStr = rahbarToDate;
      if (rahbarIsToday) {
        const today = new Date();
        const start = new Date(today);
        start.setHours(0, 0, 0, 0);
        const end = new Date(today);
        end.setHours(23, 59, 59, 999);
        fromStr = start.toISOString();
        toStr = end.toISOString();
      }

      if (fromStr && toStr) {
        const start = new Date(fromStr);
        start.setHours(0, 0, 0, 0);
        const end = new Date(toStr);
        end.setHours(23, 59, 59, 999);
        activeFilters.push({
          field: "executionTime",
          operator: "between",
          value: start.toISOString(),
          value2: end.toISOString()
        });
      } else if (fromStr) {
        activeFilters.push({ field: "executionTime", operator: "gt", value: new Date(fromStr).toISOString() });
      } else if (toStr) {
        activeFilters.push({ field: "executionTime", operator: "lt", value: new Date(toStr).toISOString() });
      }

      if (rahbarName) {
        activeFilters.push({ field: "rahbar1Id", operator: "equals", value: rahbarName });
      }
      if (rahbarShift) {
        activeFilters.push({ field: "shift", operator: "equals", value: rahbarShift });
      }

      setFilters(activeFilters);
      setQueryTrigger((prev) => prev + 1);
    }
  }, [activeReportTab, rahbarName, rahbarShift, rahbarFromDate, rahbarToDate, rahbarIsToday]);

  const loadTemplate = (type: string) => {
    setActiveReportTab(type);
    if (type === "history") {
      setEntity("manovr");
      setFields(["id", "type", "train", "sourceLine", "destinationLine", "rahbar1", "executionTime", "status", "confirmationStatus"]);
      setFilters([]);
      setGroupBy("");
      setChart("table");
      setSortField("id");
      setSortDirection("desc");
    } else if (type === "triangulated") {
      setEntity("manovr");
      setFields(["id", "train", "type", "sourceLine", "destinationLine", "executionTime", "status"]);
      setFilters([{ field: "type", operator: "equals", value: "3" }]);
      setGroupBy("");
      setChart("table");
      setSortField("id");
      setSortDirection("desc");
    } else if (type === "air_charged") {
      setEntity("manovr");
      setFields(["id", "train", "type", "sourceLine", "destinationLine", "executionTime", "status"]);
      setFilters([{ field: "type", operator: "equals", value: "11" }]);
      setGroupBy("");
      setChart("table");
      setSortField("id");
      setSortDirection("desc");
    } else if (type === "rahbaran") {
      setEntity("manovr");
      setFields(["id", "type", "train", "rahbar1", "executionTime"]);
      setFilters([]);
      setGroupBy("rahbar1");
      setChart("bar");
      setSortField("id");
      setSortDirection("desc");
    } else if (type === "today_manovrs") {
      setEntity("manovr");
      setFields(["id", "type", "train", "sourceLine", "destinationLine", "rahbar1", "createdAt", "status"]);
      setFilters([{ field: "createdAt", operator: "gt", value: new Date(new Date().setHours(0, 0, 0, 0)).toISOString() }]);
      setGroupBy("");
      setChart("table");
      setSortField("id");
      setSortDirection("desc");
    } else if (type === "active_trains") {
      setEntity("train");
      setFields(["id", "code", "type", "line", "slotIndex", "isDisposed"]);
      setFilters([{ field: "isDisposed", operator: "equals", value: "false" }]);
      setGroupBy("");
      setChart("table");
      setSortField("code");
      setSortDirection("asc");
    } else if (type === "line_stats") {
      setEntity("manovr");
      setFields(["id", "type", "train", "sourceLine", "executionTime"]);
      setFilters([]);
      setGroupBy("sourceLine");
      setChart("bar");
      setSortField("id");
      setSortDirection("desc");
    } else if (type === "waiting_approvals") {
      setEntity("manovr");
      setFields(["id", "type", "train", "sourceLine", "destinationLine", "rahbar1", "confirmationStatus"]);
      setFilters([{ field: "confirmationStatus", operator: "equals", value: "0" }]);
      setGroupBy("");
      setChart("table");
      setSortField("id");
      setSortDirection("desc");
    } else if (type === "disposed_trains") {
      setEntity("train");
      setFields(["id", "code", "type", "isDisposed"]);
      setFilters([{ field: "isDisposed", operator: "equals", value: "true" }]);
      setGroupBy("");
      setChart("table");
      setSortField("code");
      setSortDirection("asc");
    } else if (type === "personnel_by_shift") {
      setEntity("personnel");
      setFields(["id", "firstName", "lastName", "shift", "orgPosition", "personnelType", "personnelCode"]);
      setFilters([]);
      setGroupBy("shift");
      setChart("pie");
      setSortField("id");
      setSortDirection("desc");
    }
    setTimeout(() => {
      setQueryTrigger((prev) => prev + 1);
    }, 50);
  };

  // اجرای کوئری گزارش
  const handleQuery = useCallback(async () => {
    setError(null);
    const config: ReportConfig = {
      entity,
      fields,
      filters,
      groupBy: groupBy || undefined,
      chart,
      sortField,
      sortDirection,
    };

    startTransition(async () => {
      const res = await runDynamicReport(config);
      if (res.error) {
        setError(res.error);
      } else {
        setRecords(res.records || []);
      }
    });
  }, [entity, fields, filters, groupBy, chart, sortField, sortDirection]);

  // لود گزارش پیش‌فرض در شروع کار
  useEffect(() => {
    loadTemplate("history");
  }, []);

  // اجرای خودکار کوئری با تغییر تریگر
  useEffect(() => {
    if (queryTrigger > 0) {
      handleQuery();
    }
  }, [queryTrigger, handleQuery]);

  // ذخیره گزارش جاری
  const handleSaveReport = async () => {
    if (!reportName.trim()) {
      alert("لطفاً نام گزارش را وارد کنید.");
      return;
    }
    const config: ReportConfig = { entity, fields, filters, groupBy: groupBy || undefined, chart, sortField, sortDirection };
    const res = await saveReportAction(reportName, config, true);
    if (res.error) {
      alert(res.error);
    } else if (res.report) {
      setSavedReports((prev) => [
        {
          id: res.report!.id,
          name: res.report!.name,
          config: res.report!.config,
          isShared: res.report!.isShared,
          ownerName: "شما",
          isOwner: true,
        },
        ...prev,
      ]);
      setReportName("");
      alert("گزارش با موفقیت ذخیره شد.");
    }
  };

  // لود گزارش ذخیره شده
  const handleLoadReport = (rep: any) => {
    try {
      const config: ReportConfig = JSON.parse(rep.config);
      setEntity(config.entity);
      setFields(config.fields);
      setFilters(config.filters || []);
      setGroupBy(config.groupBy || "");
      setChart(config.chart || "table");
      setSortField(config.sortField || "");
      setSortDirection(config.sortDirection || "desc");
      alert(`گزارش "${rep.name}" بارگذاری شد.`);
    } catch {
      alert("خطا در بارگذاری گزارش.");
    }
  };

  // حذف گزارش ذخیره شده
  const handleDeleteReport = async (id: number) => {
    if (!confirm("آیا از حذف این گزارش مطمئن هستید؟")) return;
    const res = await deleteSavedReportAction(id);
    if (res.error) {
      alert(res.error);
    } else {
      setSavedReports((p) => p.filter((r) => r.id !== id));
    }
  };

  // زمان‌بندی گزارش
  const handleOpenScheduleModal = (rep: any) => {
    setSelectedReportToSchedule(rep);
    setCron("0 8 * * *");
    setFormat("excel");
    setRecipients(String(userId));
    setOutputDir("public/exports/scheduled");
    setIsScheduleModalOpen(true);
  };

  const handleCreateSchedule = async () => {
    if (!selectedReportToSchedule) return;
    const res = await createScheduledReport(
      selectedReportToSchedule.id,
      cron,
      format,
      recipients,
      outputDir
    );
    if (res.error) {
      alert(res.error);
    } else {
      alert("برنامه زمان‌بندی گزارش با موفقیت ثبت شد.");
      setIsScheduleModalOpen(false);
      setScheduledReports((prev: any) => [res.report, ...prev]);
    }
  };

  const handleToggleSchedule = async (id: number, active: boolean) => {
    const res = await toggleScheduledReport(id, active);
    if (res.error) {
      alert(res.error);
    } else {
      setScheduledReports((prev: any) =>
        prev.map((s: any) => (s.id === id ? { ...s, isActive: active } : s))
      );
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    if (!confirm("آیا از حذف این برنامه زمان‌بندی مطمئن هستید؟")) return;
    const res = await deleteScheduledReport(id);
    if (res.error) {
      alert(res.error);
    } else {
      setScheduledReports((prev: any) => prev.filter((s: any) => s.id !== id));
    }
  };

  // افزودن فیلتر جدید
  const handleAddFilter = () => {
    const available = ENTITY_FIELDS[entity];
    if (available.length > 0) {
      setFilters((prev) => [...prev, { field: available[0].key, operator: "equals", value: "" }]);
    }
  };

  const handleRemoveFilter = (idx: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateFilter = (idx: number, updated: Partial<ReportFilter>) => {
    setFilters((prev) => prev.map((f, i) => (i === idx ? { ...f, ...updated } : f)));
  };

  // فراخوانی API اکسپورت اکسل
  const handleExportExcel = async () => {
    const config: ReportConfig = { entity, fields, filters, groupBy: groupBy || undefined, chart, sortField, sortDirection };
    const response = await fetch("/api/export/excel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      alert("خطا در دانلود اکسل.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${entity}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // فراخوانی API اکسپورت PDF
  const handleExportPDF = async () => {
    const config: ReportConfig = { entity, fields, filters, groupBy: groupBy || undefined, chart, sortField, sortDirection };
    const response = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      alert("خطا در دانلود PDF.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${entity}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // دانلود تصویر نمودار به صورت PNG
  const handleDownloadChart = () => {
    const container = document.getElementById("recharts-export-container");
    if (!container) return;
    const svgElement = container.querySelector("svg");
    if (!svgElement) return;

    try {
      // 1. Serialize SVG
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const DOMURL = window.URL || window.webkitURL || window;
      const url = DOMURL.createObjectURL(svgBlob);

      // 2. Create Image and draw to Canvas
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = svgElement.clientWidth * 2 || 1200;
        canvas.height = svgElement.clientHeight * 2 || 800;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // هماهنگ‌سازی پس‌زمینه تصویر بر اساس تم جاری (تاریک/روشن)
          const isDark = document.documentElement.classList.contains("dark") || document.body.classList.contains("dark");
          ctx.fillStyle = isDark ? "#0f172a" : "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const pngUrl = canvas.toDataURL("image/png");

          // 3. دانلود مستقیم
          const downloadLink = document.createElement("a");
          downloadLink.href = pngUrl;
          downloadLink.download = `chart-${entity}-${groupBy}.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        }
        DOMURL.revokeObjectURL(url);
      };
      img.src = url;
    } catch (e) {
      console.error("Failed to download chart", e);
      alert("خطا در دانلود تصویر نمودار.");
    }
  };

  const changeChartType = (newChart: "table" | "bar" | "pie" | "line") => {
    setChart(newChart);
    if (newChart !== "table" && !groupBy) {
      if (entity === "manovr") setGroupBy("type");
      else if (entity === "train") setGroupBy("type");
      else if (entity === "line") setGroupBy("terminal");
      else if (entity === "personnel") setGroupBy("shift");
    }
  };

  // پارس فایل اکسل برای ایمپورت
  const handleExcelImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const worksheet = workbook.worksheets[0];

        const rows: any[] = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // هدر را رد کن
          const vals = Array.isArray(row.values) ? row.values : [];
          // مقادیر ستون‌ها: نام، خانوادگی، نام‌کاربری، همراه۱، همراه۲، داخلی، آدرس
          rows.push({
            firstName: String(vals[1] || "").trim(),
            lastName: String(vals[2] || "").trim(),
            userName: vals[3] ? String(vals[3]).trim() : undefined,
            phone1: vals[4] ? String(vals[4]).trim() : undefined,
            phone2: vals[5] ? String(vals[5]).trim() : undefined,
            internalTel: vals[6] ? String(vals[6]).trim() : undefined,
            address: vals[7] ? String(vals[7]).trim() : undefined,
          });
        });
        setImportPreview(rows);
      } catch (err) {
        alert("فرمت فایل اکسل معتبر نیست یا خطا در خواندن رخ داد.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ارسال داده‌های ایمپورت به سرور
  const handleImportSubmit = async () => {
    if (importPreview.length === 0) return;
    startTransition(async () => {
      const res = await importPersonnelFromExcel(importPreview);
      if (res.error) {
        alert(res.error);
      } else {
        setImportCount(res.count || 0);
        setImportPreview([]);
        setImportFile(null);
        alert(`تعداد ${res.count} پرسنل جدید با موفقیت درج شدند.`);
      }
    });
  };

  // آماده‌سازی داده‌های چارت (گروه‌بندی کلاینت‌ساید برای رسم سریع)
  const getFilteredDisplayRecords = () => {
    let list = records;
    if (activeReportTab === "rahbaran") {
      if (rahbarShift) {
        list = list.filter((r) => r.rahbar1?.shift === Number(rahbarShift));
      }
      if (rahbarName) {
        list = list.filter((r) => r.rahbar1Id === Number(rahbarName));
      }
    }
    return list;
  };

  const displayRecords = getFilteredDisplayRecords();

  const getChartData = () => {
    if (!groupBy) return [];
    const counts: Record<string, number> = {};

    displayRecords.forEach((r) => {
      let key = "نامشخص";
      if (entity === "manovr") {
        if (groupBy === "type") key = ManovrType[r.type] || String(r.type);
        else if (groupBy === "status") key = ManovrStatus[r.status] || String(r.status);
        else if (groupBy === "confirmationStatus") key = ConfirmationStatus[r.confirmationStatus] || String(r.confirmationStatus);
        else if (groupBy === "train") key = r.train?.code || "—";
        else if (groupBy === "sourceLine") key = r.sourceLine?.name || "—";
        else if (groupBy === "destinationLine") key = r.destinationLine?.name || "—";
        else if (groupBy === "rahbar1") key = r.rahbar1 ? `${r.rahbar1.firstName} ${r.rahbar1.lastName}`.trim() : "—";
        else if (groupBy === "creator") key = r.creator ? `${r.creator.firstName} ${r.creator.lastName}`.trim() : "—";
      } else if (entity === "train") {
        if (groupBy === "type") key = TrainType[r.type] || String(r.type);
        else if (groupBy === "line") key = r.line?.name || "—";
      } else if (entity === "line") {
        if (groupBy === "terminal") key = Terminal[r.terminal] || String(r.terminal);
        else if (groupBy === "isDynamic") key = r.isDynamic ? "دینامیک" : "ثابت";
      } else if (entity === "personnel") {
        if (groupBy === "shift") key = Shift[r.shift] || String(r.shift);
        else if (groupBy === "orgPosition") key = OrgPosition[r.orgPosition] || String(r.orgPosition);
        else if (groupBy === "personnelType") key = PersonnelType[r.personnelType] || String(r.personnelType);
      } else {
        key = String(r[groupBy] || "نامشخص");
      }
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts).map(([label, value]) => ({ label, value }));
  };

  const chartData = getChartData();

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* شبکه‌ی کارت‌های گزارش پیش‌تنظیم */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "8px"
          }}
        >
          {[
            {
              id: "history",
              title: "تاریخچه مانورها",
              desc: "تاریخچه کل مانورهای ثبت شده در پایانه",
              icon: (
                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M4 3v18M20 3v18M4 7h16M4 12h16M4 17h16" />
                </svg>
              )
            },
            {
              id: "triangulated",
              title: "لیست قطارهای مثلث شده",
              desc: "قطارهایی که مانور تارواش/مثلث داشته‌اند",
              icon: (
                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <rect x="4" y="3" width="16" height="15" rx="3" />
                  <path d="M4 11h16M8 7h2M14 7h2M6 18l-2 3M18 18l2 3M9 15h6" />
                </svg>
              )
            },
            {
              id: "air_charged",
              title: "لیست قطارهای بادگیری شده",
              desc: "قطارهایی که مانور تست بادگیری داشته‌اند",
              icon: (
                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <rect x="2" y="5" width="20" height="10" rx="2" />
                  <circle cx="6" cy="18" r="2" />
                  <circle cx="18" cy="18" r="2" />
                  <path d="M10 5v10M14 5v10" />
                </svg>
              )
            },
            {
              id: "rahbaran",
              title: "عملکرد راهبران",
              desc: "خلاصه مانورهای انجام شده به تفکیک راهبران",
              icon: (
                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M18 20V10M12 20V4M6 20v-6" />
                </svg>
              )
            },
            {
              id: "today_manovrs",
              title: "مانورهای امروز",
              desc: "لیست کلیه مانورهای ثبت‌شده از ابتدای امروز",
              icon: (
                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              )
            },
            {
              id: "active_trains",
              title: "قطارهای مستقر در دپو",
              desc: "لیست قطارهای فعال مستقر بر روی ریل‌ها",
              icon: (
                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M4 15V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7m-16 0v4h16v-4m-16 0h16M7 11h2m6 0h2" />
                </svg>
              )
            },
            {
              id: "line_stats",
              title: "آمار ترافیک خطوط",
              desc: "تعداد کل مانورها به تفکیک خطوط ریلی مبدأ",
              icon: (
                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                </svg>
              )
            },
            {
              id: "waiting_approvals",
              title: "مانورهای منتظر تأیید",
              desc: "مانورهایی که در انتظار تایید نهایی مدیر هستند",
              icon: (
                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m5 .5c0 5.747-3.974 10.658-9 12-5.026-1.342-9-6.253-9-12V6l9-4 9 4v6.5z" />
                </svg>
              )
            },
            {
              id: "disposed_trains",
              title: "قطارهای اسقاط شده",
              desc: "لیست قطارهای اسقاط/غیرفعال پایانه",
              icon: (
                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )
            },
            {
              id: "personnel_by_shift",
              title: "توزیع شیفت پرسنل",
              desc: "تعداد و آمار پرسنل به تفکیک شیفت کاری (A, B, C)",
              icon: (
                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m12-10a4 4 0 11-8 0 4 4 0 018 0zm6 10v-2a4 4 0 00-3-3.87m-4-12a4 4 0 01-1-7.87M23 21v-2a4 4 0 00-3-3.87" />
                </svg>
              )
            }
          ].map((tpl) => {
            const isActive = activeReportTab === tpl.id;
            return (
              <div
                key={tpl.id}
                onClick={() => loadTemplate(tpl.id)}
                className="card cursor-pointer transition-all duration-300 hover:shadow-xl"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px",
                  borderRadius: "12px",
                  border: isActive ? "2px solid var(--accent)" : "2px solid var(--line)",
                  background: isActive
                    ? "linear-gradient(135deg, rgba(30,58,138,0.12) 0%, rgba(15,23,42,0.15) 100%)"
                    : "var(--panel)",
                  transform: isActive ? "scale(1.02)" : "scale(1)",
                  boxShadow: isActive ? "0 0 15px rgba(216,132,42,0.12)" : "none"
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, paddingLeft: "12px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: isActive ? "var(--accent)" : "var(--ink)" }}>
                    {tpl.title}
                  </span>
                  <span className="muted" style={{ fontSize: "11px", lineHeight: "1.3", color: "var(--ink-soft)" }}>
                    {tpl.desc}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    placeItems: "center",
                    color: isActive ? "var(--accent)" : "var(--ink-soft)",
                    opacity: isActive ? 1 : 0.7
                  }}
                >
                  {tpl.icon}
                </div>
              </div>
            );
          })}
        </div>

        {/* پنل‌های فیلتر پیشرفته بر اساس الگوها */}
        {(activeReportTab === "history" || activeReportTab === "triangulated" || activeReportTab === "air_charged") && (
          <div className="card" style={{ padding: "16px", borderRadius: "12px", background: "var(--panel)", overflow: "visible" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", borderBottom: "1px solid var(--line)", paddingBottom: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: "bold", color: "var(--accent)" }}>
                🔍 فیلترهای پیشرفته تاریخچه مانورها {activeReportTab === "triangulated" && " (قطارهای مثلث شده)"} {activeReportTab === "air_charged" && " (قطارهای بادگیری شده)"}:
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "12px" }}>
              {/* از تاریخ */}
              <div className="field" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: "11px" }}>از تاریخ:</label>
                <JalaliDateTimePicker
                  value={historyFromDate}
                  onChange={(val) => setHistoryFromDate(val)}
                />
              </div>
              {/* تا تاریخ */}
              <div className="field" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: "11px" }}>تا تاریخ:</label>
                <JalaliDateTimePicker
                  value={historyToDate}
                  onChange={(val) => setHistoryToDate(val)}
                />
              </div>
              {/* نوع */}
              <div className="field" style={{ marginBottom: 0, opacity: (activeReportTab === "history") ? 1 : 0.5 }}>
                <label style={{ fontSize: "11px" }}>نوع مانور:</label>
                <select
                  className="input sm"
                  style={{ height: "38px" }}
                  value={activeReportTab === "triangulated" ? "3" : activeReportTab === "air_charged" ? "11" : historyType}
                  onChange={(e) => setHistoryType(e.target.value)}
                  disabled={activeReportTab !== "history"}
                >
                  <option value="">-- همه --</option>
                  {Object.entries(ManovrType).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {/* قطار */}
              <div className="field" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: "11px" }}>قطار:</label>
                <select
                  className="input sm"
                  style={{ height: "38px" }}
                  value={historyTrainId}
                  onChange={(e) => setHistoryTrainId(e.target.value)}
                >
                  <option value="">-- همه --</option>
                  {trains.map((t) => (
                    <option key={t.id} value={t.id}>قطار {t.code}</option>
                  ))}
                </select>
              </div>
              {/* مبدأ */}
              <div className="field" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: "11px" }}>مبدأ مانور:</label>
                <select
                  className="input sm"
                  style={{ height: "38px" }}
                  value={historySourceLineId}
                  onChange={(e) => setHistorySourceLineId(e.target.value)}
                >
                  <option value="">-- همه --</option>
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              {/* مقصد */}
              <div className="field" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: "11px" }}>مقصد مانور:</label>
                <select
                  className="input sm"
                  style={{ height: "38px" }}
                  value={historyDestLineId}
                  onChange={(e) => setHistoryDestLineId(e.target.value)}
                >
                  <option value="">-- همه --</option>
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {activeReportTab === "rahbaran" && (
          <div className="card" style={{ padding: "16px", borderRadius: "12px", background: "var(--panel)", overflow: "visible" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", borderBottom: "1px solid var(--line)", paddingBottom: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: "bold", color: "var(--accent)" }}>
                👤 فیلترهای پیشرفته عملکرد راهبران:
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1.5fr", gap: "12px", alignItems: "center" }}>
              {/* نام راهبر */}
              <div className="field" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: "11px" }}>نام راهبر:</label>
                <select
                  className="input sm"
                  style={{ height: "38px" }}
                  value={rahbarName}
                  onChange={(e) => setRahbarName(e.target.value)}
                >
                  <option value="">-- همه راهبران --</option>
                  {personnel.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              {/* نوع شیفت */}
              <div className="field" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: "11px" }}>نوع شیفت:</label>
                <select
                  className="input sm"
                  style={{ height: "38px" }}
                  value={rahbarShift}
                  onChange={(e) => setRahbarShift(e.target.value)}
                >
                  <option value="">-- همه شیفت‌ها --</option>
                  {Object.entries(Shift).map(([k, v]) => (
                    <option key={k} value={k}>شیفت {v}</option>
                  ))}
                </select>
              </div>
              {/* از تاریخ */}
              <div className="field" style={{ marginBottom: 0, opacity: rahbarIsToday ? 0.5 : 1 }}>
                <label style={{ fontSize: "11px" }}>از تاریخ:</label>
                <JalaliDateTimePicker
                  value={rahbarFromDate}
                  onChange={(val) => !rahbarIsToday && setRahbarFromDate(val)}
                />
              </div>
              {/* تا تاریخ */}
              <div className="field" style={{ marginBottom: 0, opacity: rahbarIsToday ? 0.5 : 1 }}>
                <label style={{ fontSize: "11px" }}>تا تاریخ:</label>
                <JalaliDateTimePicker
                  value={rahbarToDate}
                  onChange={(val) => !rahbarIsToday && setRahbarToDate(val)}
                />
              </div>
              {/* چک باکس روز جاری */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  cursor: "pointer",
                  marginTop: "20px",
                  backgroundColor: "var(--panel-2)",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)"
                }}
              >
                <input
                  type="checkbox"
                  checked={rahbarIsToday}
                  onChange={(e) => setRahbarIsToday(e.target.checked)}
                />
                <b>مشاهده عملکرد راهبران برای روز جاری</b>
              </label>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px" }}>

          {/* پنل سمت راست: گزارش‌های ذخیره شده و ایمپورت */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            <div className="card">
              <div className="card-head">
                <h2>گزارش‌های ذخیره‌شده</h2>
              </div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "320px", overflowY: "auto" }}>
                {savedReports.length === 0 ? (
                  <span className="muted text-xs">هیچ گزارش ذخیره شده‌ای وجود ندارد.</span>
                ) : (
                  savedReports.map((rep) => (
                    <div key={rep.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", backgroundColor: "var(--panel-2)", borderRadius: "6px" }}>
                      <div style={{ cursor: "pointer", flex: 1 }} onClick={() => handleLoadReport(rep)}>
                        <b style={{ fontSize: "13px" }}>{rep.name}</b>
                        <div style={{ fontSize: "10px", color: "var(--ink-faint)" }}>سازنده: {rep.ownerName}</div>
                      </div>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          className="btn sm outline"
                          style={{ padding: "2px 6px", fontSize: "10px", borderColor: "var(--line)" }}
                          onClick={() => handleOpenScheduleModal(rep)}
                          title="زمان‌بندی دوره‌ای گزارش"
                        >
                          ⏱️
                        </button>
                        {rep.isOwner && (
                          <button
                            className="btn sm"
                            style={{ padding: "2px 4px", fontSize: "10px", color: "var(--crit)", borderColor: "transparent" }}
                            onClick={() => handleDeleteReport(rep.id)}
                          >
                            حذف
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* کارت زمان‌بندی‌های فعال */}
            <div className="card">
              <div className="card-head">
                <h2>زمان‌بندی‌های فعال</h2>
              </div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "320px", overflowY: "auto" }}>
                {scheduledReports.length === 0 ? (
                  <span className="muted text-xs">هیچ زمان‌بندی فعالی وجود ندارد.</span>
                ) : (
                  scheduledReports.map((sr: any) => (
                    <div key={sr.id} style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "8px", backgroundColor: "var(--panel-2)", borderRadius: "6px", fontSize: "11px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <b>{sr.savedReport?.name || `گزارش ${sr.savedReportId}`}</b>
                        <span className="num muted" style={{ fontSize: "10px" }}>{sr.format.toUpperCase()}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--ink-soft)" }}>
                        <span className="num" style={{ fontWeight: "bold" }}>{sr.cron}</span>
                        <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={sr.isActive}
                            onChange={(e) => handleToggleSchedule(sr.id, e.target.checked)}
                          />
                          فعال
                        </label>
                      </div>
                      {sr.lastRunAt && (
                        <div className="num muted" style={{ fontSize: "9px" }}>
                          آخرین اجرا: {new Date(sr.lastRunAt).toLocaleString("fa-IR", { calendar: "persian", timeZone: "Asia/Tehran" })}
                        </div>
                      )}
                      <button
                        className="btn sm outline"
                        style={{ padding: "2px 4px", fontSize: "10px", color: "var(--crit)", borderColor: "transparent", width: "100%", marginTop: "4px" }}
                        onClick={() => handleDeleteSchedule(sr.id)}
                      >
                        حذف برنامه
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {canImport && (
              <div className="card">
                <div className="card-head">
                  <h2>ورود پرسنل از اکسل</h2>
                </div>
                <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "11px", color: "var(--ink-soft)" }}>
                    یک فایل اکسل با سرستون‌های زیر آپلود کنید:
                    <br />
                    <b>نام | خانوادگی | نام‌کاربری | همراه۱ | همراه۲ | داخلی | آدرس</b>
                  </span>
                  <input type="file" accept=".xlsx" className="input" onChange={handleExcelImportChange} style={{ fontSize: "12px" }} />
                  {importPreview.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <div style={{ fontSize: "11px", color: "var(--good)", marginBottom: "4px" }}>
                        فایل آماده ایمپورت: {importPreview.length} ردیف
                      </div>
                      <button className="btn primary sm" style={{ width: "100%" }} onClick={handleImportSubmit} disabled={isPending}>
                        شروع درج در دیتابیس
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* پنل سمت چپ: گزارش‌ساز پویا */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            <div className="card" style={{ padding: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "16px" }}>
                <div className="field">
                  <label>انتخاب موجودیت گزارش</label>
                  <select
                    className="input"
                    value={entity}
                    onChange={(e: any) => {
                      const nextVal = e.target.value as any;
                      setEntity(nextVal);
                      const defaultFields: Record<string, string[]> = {
                        manovr: ["id", "type", "train", "createdAt", "status"],
                        train: ["code", "type", "line", "isDisposed"],
                        line: ["name", "capacity", "terminal", "isDynamic"],
                        personnel: ["firstName", "lastName", "shift", "orgPosition", "personnelType", "personnelCode"],
                      };
                      setFields(defaultFields[nextVal]);
                      setSortField(defaultFields[nextVal][0]);
                      setFilters([]);
                      setGroupBy("");
                      setActiveReportTab("");
                    }}
                  >
                    <option value="manovr">مانورهای پایانه</option>
                    <option value="train">قطارهای دپو</option>
                    <option value="line">ریل‌ها و خطوط</option>
                    <option value="personnel">پرسنل و مخاطبین</option>
                  </select>
                </div>

                <div className="field">
                  <label>نوع نمایش گزارش</label>
                  <select className="input" value={chart} onChange={(e: any) => setChart(e.target.value)}>
                    <option value="table">جدول داده‌ها (پیش‌فرض)</option>
                    <option value="bar">نمودار ستونی (Bar Chart)</option>
                    <option value="pie">نمودار دایره‌ای (Pie Chart)</option>
                    <option value="line">نمودار خطی زمانی (Line Chart)</option>
                  </select>
                </div>

                <div className="field">
                  <label>گروه‌بندی بر اساس (برای چارت)</label>
                  <select className="input" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                    <option value="">-- بدون گروه‌بندی --</option>
                    {ENTITY_FIELDS[entity].map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* انتخاب فیلدها */}
              <div className="field" style={{ marginBottom: "20px" }}>
                <label>انتخاب ستون‌های نمایشی گزارش</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", border: "1px solid var(--line)", padding: "12px", borderRadius: "9px" }}>
                  {ENTITY_FIELDS[entity].map((f) => (
                    <label key={f.key} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={fields.includes(f.key)}
                        onChange={(e) => {
                          if (e.target.checked) setFields((prev) => [...prev, f.key]);
                          else setFields((prev) => prev.filter((k) => k !== f.key));
                        }}
                        style={{ accentColor: "var(--accent)" }}
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* شروط فیلتر پیشرفته */}
              <div className="field" style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ margin: 0 }}>فیلترهای گزارش (Advanced Filter Conditions)</label>
                  <button type="button" className="btn sm" onClick={handleAddFilter}>
                    + افزودن شرط فیلتر
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {filters.map((filter, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <select
                        className="input"
                        value={filter.field}
                        onChange={(e) => handleUpdateFilter(idx, { field: e.target.value })}
                        style={{ flex: 2 }}
                      >
                        {ENTITY_FIELDS[entity].map((f) => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </select>

                      <select
                        className="input"
                        value={filter.operator}
                        onChange={(e) => handleUpdateFilter(idx, { operator: e.target.value as any })}
                        style={{ flex: 1.5 }}
                      >
                        {OPERATORS.map((op) => (
                          <option key={op.key} value={op.key}>{op.label}</option>
                        ))}
                      </select>

                      <input
                        type="text"
                        className="input"
                        placeholder="مقدار شرط"
                        value={filter.value}
                        onChange={(e) => handleUpdateFilter(idx, { value: e.target.value })}
                        style={{ flex: 3 }}
                      />

                      {filter.operator === "between" && (
                        <input
                          type="text"
                          className="input"
                          placeholder="تا مقدار"
                          value={filter.value2 || ""}
                          onChange={(e) => handleUpdateFilter(idx, { value2: e.target.value })}
                          style={{ flex: 3 }}
                        />
                      )}

                      <button
                        type="button"
                        className="btn sm"
                        style={{ color: "var(--crit)", borderColor: "transparent" }}
                        onClick={() => handleRemoveFilter(idx)}
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* مرتب‌سازی و دکمه کوئری */}
              <div style={{ display: "flex", gap: "12px", alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
                <div style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "13px" }}>
                  <span className="muted">مرتب‌سازی بر اساس:</span>
                  <select className="input" value={sortField} onChange={(e) => setSortField(e.target.value)} style={{ width: "130px", padding: "6px 8px" }}>
                    {ENTITY_FIELDS[entity].map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                  <select className="input" value={sortDirection} onChange={(e: any) => setSortDirection(e.target.value)} style={{ width: "90px", padding: "6px 8px" }}>
                    <option value="desc">نزولی</option>
                    <option value="asc">صعودی</option>
                  </select>
                </div>

                <span className="spacer" />

                <button className="btn primary" onClick={handleQuery} disabled={isPending}>
                  {isPending ? "در حال استخراج..." : "اجرای گزارش زنده"}
                </button>
              </div>
            </div>

            {/* پیش‌نمایش گزارش و چارت */}
            {error && <div className="err">{error}</div>}

            {displayRecords.length > 0 && (
              <div className="card" style={{ padding: "20px" }}>
                <div className="card-head" style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center" }}>
                  <h2>خروجی و تحلیل داده‌ها ({displayRecords.length} ردیف)</h2>
                  <span className="spacer" />

                  {/* دکمه‌های سوئیچ سریع نوع نمایش */}
                  <div style={{ display: "flex", gap: "4px", backgroundColor: "var(--bg)", padding: "4px", borderRadius: "8px", border: "1px solid var(--line)", marginLeft: "12px", marginRight: "12px" }}>
                    <button
                      onClick={() => changeChartType("table")}
                      className="btn sm"
                      style={{
                        backgroundColor: chart === "table" ? "var(--accent)" : "transparent",
                        color: chart === "table" ? "#fff" : "var(--ink-soft)",
                        border: "none",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: chart === "table" ? "bold" : "normal",
                        cursor: "pointer"
                      }}
                    >
                      📋 جدول
                    </button>
                    <button
                      onClick={() => changeChartType("bar")}
                      className="btn sm"
                      style={{
                        backgroundColor: chart === "bar" ? "var(--accent)" : "transparent",
                        color: chart === "bar" ? "#fff" : "var(--ink-soft)",
                        border: "none",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: chart === "bar" ? "bold" : "normal",
                        cursor: "pointer"
                      }}
                    >
                      📊 ستونی
                    </button>
                    <button
                      onClick={() => changeChartType("pie")}
                      className="btn sm"
                      style={{
                        backgroundColor: chart === "pie" ? "var(--accent)" : "transparent",
                        color: chart === "pie" ? "#fff" : "var(--ink-soft)",
                        border: "none",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: chart === "pie" ? "bold" : "normal",
                        cursor: "pointer"
                      }}
                    >
                      🍩 دایره‌ای
                    </button>
                    <button
                      onClick={() => changeChartType("line")}
                      className="btn sm"
                      style={{
                        backgroundColor: chart === "line" ? "var(--accent)" : "transparent",
                        color: chart === "line" ? "#fff" : "var(--ink-soft)",
                        border: "none",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: chart === "line" ? "bold" : "normal",
                        cursor: "pointer"
                      }}
                    >
                      📈 خطی
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    {chart !== "table" && (
                      <button className="btn sm primary" onClick={handleDownloadChart}>📥 دانلود تصویر نمودار</button>
                    )}
                    <button className="btn sm accent" onClick={handleExportExcel}>خروجی Excel راست‌چین</button>
                    <button className="btn sm accent" onClick={handleExportPDF}>خروجی PDF فارسی</button>
                  </div>
                </div>

                <div style={{ marginTop: "16px" }}>
                  {chart !== "table" && groupBy && (
                    <div style={{ marginBottom: "32px", borderBottom: "1px solid var(--line)", paddingBottom: "24px" }}>
                      <div id="recharts-export-container" style={{ width: "100%", background: "transparent", padding: "10px" }}>
                        {chart === "bar" && (
                          <div style={{ width: "100%", height: 320, direction: "ltr" }}>
                            <ResponsiveContainer>
                              <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} interval={0} height={50} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--ink-soft)" }} />
                                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} />
                                <Bar dataKey="value" fill="var(--accent)" radius={[5, 5, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}

                        {chart === "pie" && (
                          <div style={{ width: "100%", height: 300, direction: "ltr" }}>
                            <ResponsiveContainer>
                              <PieChart>
                                <Pie data={chartData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={100} label>
                                  {chartData.map((_, i) => (
                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        )}

                        {chart === "line" && (
                          <div style={{ width: "100%", height: 320, direction: "ltr" }}>
                            <ResponsiveContainer>
                              <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--ink-soft)" }} />
                                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} />
                                <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* جدول داده‌ها همواره به همراه نمودارها یا به تنهایی نمایش داده می‌شود */}
                  <div className="tbl-wrap">
                    {chart !== "table" && (
                      <h3 style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "12px", color: "var(--accent)" }}>
                        📋 جدول داده‌های تفصیلی گزارش (Data Table)
                      </h3>
                    )}
                    <table className="data">
                      <thead>
                        <tr>
                          {fields.map((f) => (
                            <th key={f}>{ENTITY_FIELDS[entity].find((x) => x.key === f)?.label || f}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {displayRecords.map((r, i) => (
                          <tr key={i}>
                            {fields.map((f) => {
                              let val = r[f];
                              // فرمت‌دهی مقادیر خاص
                              if (entity === "manovr") {
                                if (f === "type") val = ManovrType[r.type];
                                else if (f === "status") val = ManovrStatus[r.status];
                                else if (f === "confirmationStatus") val = ConfirmationStatus[r.confirmationStatus];
                                else if (f === "train") val = r.train?.code;
                                else if (f === "sourceLine") val = r.sourceLine?.name;
                                else if (f === "destinationLine") val = r.destinationLine?.name;
                                else if (f === "rahbar1") val = r.rahbar1 ? `${r.rahbar1.firstName} ${r.rahbar1.lastName}` : "";
                                else if (f === "creator") val = r.creator ? `${r.creator.firstName} ${r.creator.lastName}` : "سیستم";
                                else if (f === "createdAt") val = new Date(r.createdAt).toLocaleString("fa-IR", { timeZone: "Asia/Tehran", calendar: "persian" });
                                else if (f === "finishedAt") val = r.finishedAt ? new Date(r.finishedAt).toLocaleString("fa-IR", { timeZone: "Asia/Tehran", calendar: "persian" }) : "";
                                else if (f === "executionTime") val = r.executionTime ? new Date(r.executionTime).toLocaleString("fa-IR", { timeZone: "Asia/Tehran", calendar: "persian" }) : "";
                              } else if (entity === "train") {
                                if (f === "type") val = TrainType[r.type];
                                else if (f === "line") val = r.line?.name;
                                else if (f === "isDisposed") val = r.isDisposed ? "غیرفعال" : "فعال";
                              } else if (entity === "line") {
                                if (f === "terminal") val = Terminal[r.terminal];
                                else if (f === "isDynamic") val = r.isDynamic ? "دینامیک" : "ثابت";
                              } else if (entity === "personnel") {
                                if (f === "shift") val = Shift[r.shift];
                                else if (f === "orgPosition") val = OrgPosition[r.orgPosition];
                                else if (f === "personnelType") val = PersonnelType[r.personnelType];
                                else if (f === "personnelCode") val = r.personnelCode;
                              }
                              return <td key={f} className={typeof val === "number" || (val && val.includes("/")) ? "num" : ""}>{val ?? "—"}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ذخیره کردن گزارش */}
                <div style={{ display: "flex", gap: "12px", alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: "16px", marginTop: "16px" }}>
                  <input
                    type="text"
                    placeholder="نامی برای ذخیره این گزارش وارد کنید..."
                    className="input"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    style={{ maxWidth: "300px" }}
                  />
                  <button className="btn primary" onClick={handleSaveReport}>
                    ذخیره پیکربندی گزارش
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* مودال تعریف زمان‌بندی گزارش */}
      {isScheduleModalOpen && selectedReportToSchedule && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "500px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--line)",
                paddingBottom: "12px",
              }}
            >
              <h3 style={{ fontSize: "15px", fontWeight: "bold" }}>
                ⏱️ تنظیم زمان‌بندی برای: {selectedReportToSchedule.name}
              </h3>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div className="field">
              <label>قالب زمان‌بندی (Cron Expression) *</label>
              <input
                type="text"
                className="input num"
                value={cron}
                onChange={(e) => setCron(e.target.value)}
                placeholder="* * * * *"
                style={{ direction: "ltr", textAlign: "left" }}
              />
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                <button
                  type="button"
                  className="btn sm outline"
                  style={{ fontSize: "10px", padding: "2px 6px" }}
                  onClick={() => setCron("*/5 * * * *")}
                >
                  هر ۵ دقیقه
                </button>
                <button
                  type="button"
                  className="btn sm outline"
                  style={{ fontSize: "10px", padding: "2px 6px" }}
                  onClick={() => setCron("0 * * * *")}
                >
                  هر ساعت
                </button>
                <button
                  type="button"
                  className="btn sm outline"
                  style={{ fontSize: "10px", padding: "2px 6px" }}
                  onClick={() => setCron("0 8 * * *")}
                >
                  هر روز ۸ صبح
                </button>
                <button
                  type="button"
                  className="btn sm outline"
                  style={{ fontSize: "10px", padding: "2px 6px" }}
                  onClick={() => setCron("0 8 * * 6")}
                >
                  شنبه‌ها ۸ صبح
                </button>
              </div>
            </div>

            <div className="grid2">
              <div className="field">
                <label>فرمت فایل خروجی *</label>
                <select
                  className="input"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option value="excel">Excel (xlsx)</option>
                  <option value="pdf">PDF (pdf)</option>
                </select>
              </div>
              <div className="field">
                <label>شناسه دریافت‌کنندگان (کاما) *</label>
                <input
                  type="text"
                  className="input num"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  style={{ direction: "ltr", textAlign: "left" }}
                />
              </div>
            </div>

            <div className="field">
              <label>نام پوشه فرعی خروجی (اختیاری — داخل پوشه عمومی سامانه)</label>
              <input
                type="text"
                className="input num"
                placeholder="مانند: daily یا e.g. monthly"
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
                style={{ direction: "ltr", textAlign: "left" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="btn outline"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleCreateSchedule}
                className="btn primary"
              >
                ثبت و فعال‌سازی
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
