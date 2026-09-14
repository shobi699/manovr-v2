"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPhonebookContact,
  updatePersonnelPhoneInfo,
  deletePhonebookContact,
  importPersonnelFromExcel,
} from "@/app/actions/user";
import type { ListParams } from "@/lib/list-query";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
  preValidatePersonnelImport,
  executePersonnelImportBatch,
} from "@/app/actions/excel-import";
import ExcelConflictModal from "@/components/ExcelConflictModal";
import ExcelImportSummaryModal from "@/components/ExcelImportSummaryModal";
import PersonnelDetailModal from "@/components/PersonnelDetailModal";
import { persianSearchMatch } from "@/lib/persian-text";
import type {
  ImportConflictItem,
  ImportPersonnelRow,
  BatchImportPayload,
  ImportSummaryReport,
} from "@/lib/excel-import-types";

interface PersonnelItem {
  id: number;
  firstName: string;
  lastName: string;
  phone1: string;
  phone2: string;
  internalTel: string;
  address: string;
  avatarColor: string;
  shift: number;
  orgPosition: number;
  personnelCode?: string | null;
}

export default function PhonebookClient({
  initialPersonnel,
  totalRows,
  params,
  canEdit,
  shifts,
  positions,
}: {
  initialPersonnel: PersonnelItem[];
  totalRows?: number;
  params?: ListParams;
  canEdit: boolean;
  shifts: Record<number, string>;
  positions: Record<number, string>;
}) {
  const router = useRouter();
  const [list, setList] = useState(initialPersonnel);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [posFilter, setPosFilter] = useState("all");
  const [deletePersonTarget, setDeletePersonTarget] = useState<PersonnelItem | null>(null);
  const [detailPerson, setDetailPerson] = useState<PersonnelItem | null>(null);
  const { toast } = useToast();

  // دیبانس کردن ورودی جستجو جهت عملکرد فوق‌سریع و جلوگیری از لگ رابط کاربری
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  // افزودن مخاطب جدید
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addFirstName, setAddFirstName] = useState("");
  const [addLastName, setAddLastName] = useState("");
  const [addPersonnelCode, setAddPersonnelCode] = useState("");
  const [addShift, setAddShift] = useState(1);
  const [addOrgPosition, setAddOrgPosition] = useState(4);
  const [addPhone1, setAddPhone1] = useState("");
  const [addPhone2, setAddPhone2] = useState("");
  const [addInternalTel, setAddInternalTel] = useState("");
  const [addAddress, setAddAddress] = useState("");
  const [addAvatarColor, setAddAvatarColor] = useState("#2563eb");

  // ویرایش مخاطب
  const [editingPerson, setEditingPerson] = useState<PersonnelItem | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPersonnelCode, setEditPersonnelCode] = useState("");
  const [editShift, setEditShift] = useState(1);
  const [editOrgPosition, setEditOrgPosition] = useState(4);
  const [editPhone1, setEditPhone1] = useState("");
  const [editPhone2, setEditPhone2] = useState("");
  const [editInternalTel, setEditInternalTel] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editAvatarColor, setEditAvatarColor] = useState("");

  // استیت‌های مدال تعارضات اکسل و گزارش آماری
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const [conflictsList, setConflictsList] = useState<ImportConflictItem[]>([]);
  const [nonConflictingList, setNonConflictingList] = useState<ImportPersonnelRow[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummaryReport | null>(null);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleExportExcel = async () => {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("دفتر تلفن");
      worksheet.views = [{ rtl: true } as any];

      worksheet.columns = [
        { header: "نام", key: "firstName", width: 15 },
        { header: "نام خانوادگی", key: "lastName", width: 15 },
        { header: "کد پرسنلی", key: "personnelCode", width: 15 },
        { header: "شیفت", key: "shift", width: 10 },
        { header: "سمت", key: "position", width: 15 },
        { header: "تلفن همراه ۱", key: "phone1", width: 15 },
        { header: "تلفن همراه ۲", key: "phone2", width: 15 },
        { header: "تلفن داخلی", key: "internalTel", width: 12 },
        { header: "آدرس منزل", key: "address", width: 30 },
      ];

      filtered.forEach((p) => {
        worksheet.addRow({
          firstName: p.firstName,
          lastName: p.lastName,
          personnelCode: p.personnelCode || "—",
          shift: shifts[p.shift] || p.shift,
          position: positions[p.orgPosition] || p.orgPosition,
          phone1: p.phone1 || "—",
          phone2: p.phone2 || "—",
          internalTel: p.internalTel || "—",
          address: p.address || "—",
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "phonebook.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error("خطا در خروجی گرفتن اکسل.");
    }
  };

  const handleDownloadSample = async () => {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("نمونه ورود دفتر تلفن");
      worksheet.views = [{ rtl: true } as any];

      worksheet.columns = [
        { header: "نام *", key: "firstName", width: 15 },
        { header: "نام خانوادگی *", key: "lastName", width: 15 },
        { header: "کد پرسنلی (یکتا)", key: "personnelCode", width: 15 },
        { header: "نام کاربری", key: "userName", width: 15 },
        { header: "همراه ۱", key: "phone1", width: 15 },
        { header: "همراه ۲", key: "phone2", width: 15 },
        { header: "داخلی پایانه", key: "internalTel", width: 12 },
        { header: "آدرس منزل", key: "address", width: 30 },
        { header: "شیفت (1=A, 2=B, 3=C)", key: "shift", width: 12 },
        { header: "سمت (1=راهبر، 2=مسئول شیفت، 4=تکنیسین، 5=سایر)", key: "orgPosition", width: 25 },
      ];

      worksheet.addRow({
        firstName: "محمد",
        lastName: "کریمی",
        personnelCode: "99103",
        userName: "",
        phone1: "09121111111",
        phone2: "",
        internalTel: "135",
        address: "تهران، میدان ونک",
        shift: 1,
        orgPosition: 4,
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "phonebook-sample.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
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

        const rows: ImportPersonnelRow[] = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const vals = Array.isArray(row.values) ? row.values : [];
          
          const firstName = String(vals[1] || "").trim();
          const lastName = String(vals[2] || "").trim();
          if (!firstName || !lastName) return;

          const personnelCode = vals[3] ? String(vals[3]).trim() : undefined;
          const userName = vals[4] ? String(vals[4]).trim() : undefined;
          const phone1 = vals[5] ? String(vals[5]).trim() : undefined;
          const phone2 = vals[6] ? String(vals[6]).trim() : undefined;
          const internalTel = vals[7] ? String(vals[7]).trim() : undefined;
          const address = vals[8] ? String(vals[8]).trim() : undefined;
          const shift = vals[9] ? Number(vals[9]) : undefined;
          const orgPosition = vals[10] ? Number(vals[10]) : undefined;

          rows.push({
            rowIndex: rowNumber,
            firstName,
            lastName,
            personnelCode,
            userName,
            phone1,
            phone2,
            internalTel,
            address,
            shift,
            orgPosition,
          });
        });

        if (rows.length === 0) {
          toast.warning("هیچ داده معتبری در فایل پیدا نشد.");
          return;
        }

        const valResult = await preValidatePersonnelImport(rows);
        if (!valResult.ok) {
          toast.error(valResult.error || "خطا در بررسی اولیه داده‌های فایل اکسل.");
          return;
        }

        if (valResult.conflicts.length > 0) {
          setConflictsList(valResult.conflicts);
          setNonConflictingList(valResult.nonConflicting);
          setConflictModalOpen(true);
        } else {
          const res = await executePersonnelImportBatch({
            newRecords: valResult.nonConflicting,
            resolutions: [],
          });
          if (!res.ok) {
            toast.error(res.error || "خطا در ثبت مخاطبین در دیتابیس.");
          } else {
            setImportSummary(res);
            setSummaryModalOpen(true);
            router.refresh();
          }
        }
      } catch (err) {
        console.error(err);
        toast.error("فرمت فایل اکسل معتبر نیست یا خطا در خواندن رخ داد.");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmConflictResolution = async (payload: BatchImportPayload) => {
    setIsSubmittingImport(true);
    try {
      const res = await executePersonnelImportBatch(payload);
      setConflictModalOpen(false);
      if (!res.ok) {
        toast.error(res.error || "خطا در اعمال تغییرات دسته‌ای.");
      } else {
        setImportSummary(res);
        setSummaryModalOpen(true);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      toast.error("خطای غیرمنتظره در ثبت اطلاعات.");
    } finally {
      setIsSubmittingImport(false);
    }
  };

  // ایجاد مخاطب جدید
  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.append("firstName", addFirstName);
    fd.append("lastName", addLastName);
    fd.append("personnelCode", addPersonnelCode);
    fd.append("shift", String(addShift));
    fd.append("orgPosition", String(addOrgPosition));
    fd.append("phone1", addPhone1);
    fd.append("phone2", addPhone2);
    fd.append("internalTel", addInternalTel);
    fd.append("address", addAddress);
    fd.append("avatarColor", addAvatarColor);

    startTransition(async () => {
      const res = await createPhonebookContact(null, fd);
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
      } else if (res.contact) {
        const newContact: PersonnelItem = {
          id: res.contact.id,
          firstName: res.contact.firstName,
          lastName: res.contact.lastName,
          personnelCode: res.contact.personnelCode || "",
          shift: res.contact.shift,
          orgPosition: res.contact.orgPosition,
          phone1: res.contact.phone1 || "",
          phone2: res.contact.phone2 || "",
          internalTel: res.contact.internalTel || "",
          address: res.contact.address || "",
          avatarColor: res.contact.avatarColor || "#2563eb",
        };
        setList((prev) => [newContact, ...prev]);
        setIsAddOpen(false);
        toast.success("مخاطب جدید با موفقیت افزوده شد.");
        // ریست فرم
        setAddFirstName("");
        setAddLastName("");
        setAddPersonnelCode("");
        setAddPhone1("");
        setAddPhone2("");
        setAddInternalTel("");
        setAddAddress("");
        router.refresh();
      }
    });
  };

  // ویرایش مخاطب
  const handleEditClick = (p: PersonnelItem) => {
    setEditingPerson(p);
    setEditFirstName(p.firstName);
    setEditLastName(p.lastName);
    setEditPersonnelCode(p.personnelCode || "");
    setEditShift(p.shift);
    setEditOrgPosition(p.orgPosition);
    setEditPhone1(p.phone1);
    setEditPhone2(p.phone2);
    setEditInternalTel(p.internalTel);
    setEditAddress(p.address);
    setEditAvatarColor(p.avatarColor || "#2563eb");
    setError(null);
  };

  const handleSavePhonebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson) return;
    setError(null);

    const fd = new FormData();
    fd.append("id", String(editingPerson.id));
    fd.append("firstName", editFirstName);
    fd.append("lastName", editLastName);
    fd.append("personnelCode", editPersonnelCode);
    fd.append("shift", String(editShift));
    fd.append("orgPosition", String(editOrgPosition));
    fd.append("phone1", editPhone1);
    fd.append("phone2", editPhone2);
    fd.append("internalTel", editInternalTel);
    fd.append("address", editAddress);
    fd.append("avatarColor", editAvatarColor);

    startTransition(async () => {
      const res = await updatePersonnelPhoneInfo(null, fd);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        setList((prev) =>
          prev.map((item) =>
            item.id === editingPerson.id
              ? {
                  ...item,
                  firstName: editFirstName,
                  lastName: editLastName,
                  personnelCode: editPersonnelCode,
                  shift: editShift,
                  orgPosition: editOrgPosition,
                  phone1: editPhone1,
                  phone2: editPhone2,
                  internalTel: editInternalTel,
                  address: editAddress,
                  avatarColor: editAvatarColor,
                }
              : item
          )
        );
        toast.success("اطلاعات مخاطب با موفقیت به‌روزرسانی شد.");
        setEditingPerson(null);
        router.refresh();
      }
    });
  };

  // حذف مخاطب
  const handleDeleteClick = (p: PersonnelItem) => {
    setDeletePersonTarget(p);
  };

  const handleConfirmDelete = async () => {
    if (!deletePersonTarget) return;
    const p = deletePersonTarget;

    startTransition(async () => {
      const res = await deletePhonebookContact(p.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        setList((prev) => prev.filter((item) => item.id !== p.id));
        toast.success("مخاطب با موفقیت حذف شد.");
        setDeletePersonTarget(null);
        router.refresh();
      }
    });
  };

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} در حافظه کپی شد: ${text}`);
  };

  const filtered = useMemo(() => {
    return list.filter((p) => {
      const matchesSearch =
        !debouncedSearch.trim() ||
        persianSearchMatch(`${p.firstName} ${p.lastName}`, debouncedSearch) ||
        persianSearchMatch(p.firstName, debouncedSearch) ||
        persianSearchMatch(p.lastName, debouncedSearch) ||
        persianSearchMatch(p.personnelCode, debouncedSearch) ||
        persianSearchMatch(p.phone1, debouncedSearch) ||
        persianSearchMatch(p.phone2, debouncedSearch) ||
        persianSearchMatch(p.internalTel, debouncedSearch) ||
        persianSearchMatch(p.address, debouncedSearch) ||
        persianSearchMatch(positions[p.orgPosition], debouncedSearch) ||
        persianSearchMatch(shifts[p.shift], debouncedSearch);

      const matchesShift = shiftFilter === "all" || String(p.shift) === shiftFilter;
      const matchesPos = posFilter === "all" || String(p.orgPosition) === posFilter;

      return matchesSearch && matchesShift && matchesPos;
    });
  }, [list, debouncedSearch, shiftFilter, posFilter, positions, shifts]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* بخش جستجو و فیلتر با پشتیبانی از حروف فارسی و دیبانس لحظه‌ای */}
      <div
        className="toolbar"
        style={{
          backgroundColor: "var(--panel)",
          padding: "16px",
          borderRadius: "var(--radius)",
          border: "1px solid var(--line)",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 320px", maxWidth: "420px" }}>
          <input
            type="text"
            placeholder="جستجو (نام، کد پرسنلی، شماره تلفن، داخلی، سمت...)"
            className="input search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", paddingInlineEnd: search ? "32px" : "12px" }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "var(--ink-faint)",
                cursor: "pointer",
                fontSize: "14px",
                padding: "4px",
              }}
              title="پاک‌کردن جستجو"
            >
              ✕
            </button>
          )}
        </div>

        <select
          className="input"
          value={shiftFilter}
          onChange={(e) => setShiftFilter(e.target.value)}
          style={{ maxWidth: "150px" }}
        >
          <option value="all">همه شیفت‌ها</option>
          {Object.entries(shifts).map(([val, name]) => (
            <option key={val} value={val}>
              شیفت {name}
            </option>
          ))}
        </select>

        <select
          className="input"
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value)}
          style={{ maxWidth: "180px" }}
        >
          <option value="all">همه سمت‌ها</option>
          {Object.entries(positions).map(([val, name]) => (
            <option key={val} value={val}>
              {name}
            </option>
          ))}
        </select>

        {(search || shiftFilter !== "all" || posFilter !== "all") && (
          <button
            type="button"
            className="btn sm"
            onClick={() => {
              setSearch("");
              setShiftFilter("all");
              setPosFilter("all");
            }}
            style={{ fontSize: "12px" }}
          >
            حذف فیلترها
          </button>
        )}

        <span className="spacer" />
        <div className="muted" style={{ fontSize: "13px", fontWeight: 650 }}>
          یافت شد: {filtered.length} نفر
        </div>
      </div>

      {/* نوار ابزار اصلی و عملیات مخاطبان */}
      <div className="card" style={{ padding: "16px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
        {canEdit && (
          <button
            onClick={() => {
              setError(null);
              setIsAddOpen(true);
            }}
            className="btn primary sm"
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", fontWeight: "bold" }}
          >
            <span style={{ fontSize: "16px" }}>+</span> افزودن مخاطب جدید
          </button>
        )}

        <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--ink)", marginRight: "8px" }}>عملیات اکسل:</span>
        
        <button onClick={handleExportExcel} className="btn sm" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "16px" }}>📥</span> خروجی اکسل دفتر تلفن
        </button>
        
        {canEdit && (
          <>
            <label className="btn sm" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", margin: 0, padding: "8px 12px", border: "1px solid var(--line)" }}>
              <span style={{ fontSize: "16px" }}>📤</span> بارگذاری اکسل مخاطبان
              <input type="file" accept=".xlsx" onChange={handleExcelImport} style={{ display: "none" }} />
            </label>
            
            <button onClick={handleDownloadSample} className="btn sm" style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "transparent", border: "1px dashed var(--line)" }}>
              <span style={{ fontSize: "16px" }}>📄</span> دانلود نمونه اکسل ورودی
            </button>
          </>
        )}
      </div>

      {/* نمایش کارتی پرسنل و مخاطبان */}
      {filtered.length === 0 ? (
        <div className="card empty">مخاطبی با فیلترهای مشخص شده یافت نشد.</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
            gap: "18px",
          }}
        >
          {filtered.map((p) => (
            <div
              key={p.id}
              className="group card"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: 0,
                borderRadius: "16px",
                overflow: "hidden",
                border: "1px solid var(--line)",
                backgroundColor: "var(--panel)",
                boxShadow: "var(--sh-1)",
                transition: "all 0.25s ease",
              }}
            >
              {/* سربرگ کارت: آواتار و اطلاعات هویتی */}
              <div style={{ padding: "16px 18px", display: "flex", gap: "14px", alignItems: "flex-start" }}>
                {/* آواتار */}
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "14px",
                    backgroundColor: p.avatarColor || "#2563eb",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "20px",
                    fontWeight: 900,
                    flexShrink: 0,
                    boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
                  }}
                >
                  {p.firstName[0]}
                </div>

                {/* نام و بج‌ها */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: 800,
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "var(--ink)",
                    }}
                  >
                    {p.firstName} {p.lastName}
                  </h3>

                  <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                    {p.personnelCode && (
                      <span
                        className="pill p-mut"
                        style={{ fontSize: "11px", fontFamily: "var(--mono)", fontWeight: 700 }}
                      >
                        کد: {p.personnelCode}
                      </span>
                    )}
                    <span className="pill p-rail" style={{ fontSize: "11px", fontWeight: 600 }}>
                      {positions[p.orgPosition] || "سایر"}
                    </span>
                    <span className="pill p-mut" style={{ fontSize: "11px" }}>
                      شیفت {shifts[p.shift] || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* بدنه کارت: شماره تلفن‌ها و داخلی پایانه */}
              <div
                style={{
                  borderTop: "1px solid var(--line-soft)",
                  padding: "14px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  fontSize: "13px",
                  backgroundColor: "var(--panel-2)",
                }}
              >
                {/* شماره تلفن همراه اول */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="muted" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span>📱</span> همراه ۱:
                  </span>
                  {p.phone1 ? (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <a
                        href={`tel:${p.phone1}`}
                        className="num"
                        style={{ fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}
                        title="تماس مستقیم"
                      >
                        {p.phone1}
                      </a>
                      <button
                        type="button"
                        className="btn sm"
                        style={{ padding: "2px 6px", fontSize: "10px" }}
                        onClick={() => handleCopy(p.phone1, "تلفن همراه ۱")}
                        title="کپی شماره"
                      >
                        کپی
                      </button>
                    </div>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </div>

                {/* شماره تلفن همراه دوم */}
                {p.phone2 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="muted" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span>📱</span> همراه ۲:
                    </span>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <a
                        href={`tel:${p.phone2}`}
                        className="num"
                        style={{ fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}
                        title="تماس مستقیم"
                      >
                        {p.phone2}
                      </a>
                      <button
                        type="button"
                        className="btn sm"
                        style={{ padding: "2px 6px", fontSize: "10px" }}
                        onClick={() => handleCopy(p.phone2, "تلفن همراه ۲")}
                        title="کپی شماره"
                      >
                        کپی
                      </button>
                    </div>
                  </div>
                )}

                {/* تلفن داخلی پایانه (طراحی ویژه و برجسته) */}
                <div
                  style={{
                    backgroundColor: "var(--panel)",
                    border: "1px solid var(--line)",
                    borderRadius: "10px",
                    padding: "8px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <span>☎️</span> تلفن داخلی:
                  </span>
                  {p.internalTel ? (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span
                        className="num"
                        style={{
                          fontWeight: 900,
                          fontSize: "15px",
                          color: "var(--accent-ink)",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {p.internalTel}
                      </span>
                      <button
                        type="button"
                        className="btn sm"
                        style={{ padding: "2px 6px", fontSize: "10px" }}
                        onClick={() => handleCopy(p.internalTel, "تلفن داخلی")}
                        title="کپی داخلی"
                      >
                        کپی
                      </button>
                    </div>
                  ) : (
                    <span className="muted" style={{ fontSize: "12px" }}>—</span>
                  )}
                </div>

                {p.address && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--ink-soft)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={p.address}
                  >
                    <span className="muted">🏠 نشانی:</span> {p.address}
                  </div>
                )}
              </div>

              {/* فوتر اکشن‌های کارت: دکمه مشاهده جزئیات و کنترل‌های ویرایش/حذف */}
              <div
                style={{
                  padding: "10px 16px",
                  borderTop: "1px solid var(--line-soft)",
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  backgroundColor: "var(--panel)",
                }}
              >
                {/* دکمه اختصاصی مشاهده کامل جزئیات (برای همه کاربران) */}
                <button
                  type="button"
                  onClick={() => setDetailPerson(p)}
                  className="btn sm"
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    fontWeight: 700,
                    fontSize: "12px",
                    padding: "7px 12px",
                    backgroundColor: "var(--panel-2)",
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                  }}
                >
                  <span>👁️</span> مشاهده جزئیات
                </button>

                {canEdit && (
                  <>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => handleEditClick(p)}
                      style={{
                        padding: "7px 10px",
                        fontSize: "12px",
                        color: "var(--rail)",
                        backgroundColor: "var(--rail-soft)",
                        border: "1px solid var(--line)",
                        borderRadius: "8px",
                      }}
                      title="ویرایش مخاطب"
                    >
                      ویرایش
                    </button>
                    <button
                      type="button"
                      className="btn sm"
                      style={{
                        padding: "7px 10px",
                        fontSize: "12px",
                        color: "var(--crit)",
                        backgroundColor: "var(--crit-bg)",
                        border: "1px solid var(--line)",
                        borderRadius: "8px",
                      }}
                      onClick={() => handleDeleteClick(p)}
                      disabled={isPending}
                      title="حذف مخاطب"
                    >
                      حذف
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* مودال افزودن مخاطب جدید */}
      {isAddOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 999,
            display: "grid",
            placeItems: "center",
          }}
        >
          <div className="card" style={{ width: "480px", maxHeight: "90vh", overflowY: "auto", backgroundColor: "var(--panel)" }}>
            <div className="card-head">
              <h2>افزودن مخاطب جدید به دفتر تلفن</h2>
              <span className="spacer" />
              <button className="btn sm" onClick={() => setIsAddOpen(false)}>
                بستن
              </button>
            </div>
            <form onSubmit={handleCreateContact}>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {error && <div className="err" style={{ color: "#ef4444", fontSize: "13px" }}>{error}</div>}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="field">
                    <label>نام *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      value={addFirstName}
                      onChange={(e) => setAddFirstName(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>نام خانوادگی *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      value={addLastName}
                      onChange={(e) => setAddLastName(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="field">
                    <label>کد پرسنلی (اختیاری)</label>
                    <input
                      type="text"
                      className="input num"
                      value={addPersonnelCode}
                      onChange={(e) => setAddPersonnelCode(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>شیفت کاری</label>
                    <select
                      className="input"
                      value={addShift}
                      onChange={(e) => setAddShift(Number(e.target.value))}
                    >
                      {Object.entries(shifts).map(([val, name]) => (
                        <option key={val} value={val}>
                          شیفت {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>سمت سازمانی</label>
                  <select
                    className="input"
                    value={addOrgPosition}
                    onChange={(e) => setAddOrgPosition(Number(e.target.value))}
                  >
                    {Object.entries(positions).map(([val, name]) => (
                      <option key={val} value={val}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="field">
                    <label>شماره همراه ۱</label>
                    <input
                      type="text"
                      className="input num"
                      placeholder="0912..."
                      value={addPhone1}
                      onChange={(e) => setAddPhone1(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>شماره همراه ۲</label>
                    <input
                      type="text"
                      className="input num"
                      placeholder="09..."
                      value={addPhone2}
                      onChange={(e) => setAddPhone2(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field">
                  <label>شماره داخلی پایانه</label>
                  <input
                    type="text"
                    className="input num"
                    placeholder="مثال: 120"
                    value={addInternalTel}
                    onChange={(e) => setAddInternalTel(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>آدرس منزل</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={addAddress}
                    onChange={(e) => setAddAddress(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>رنگ آواتار</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="color"
                      value={addAvatarColor}
                      onChange={(e) => setAddAvatarColor(e.target.value)}
                      style={{ width: "40px", height: "40px", padding: 0, border: "0", cursor: "pointer", borderRadius: "4px" }}
                    />
                    <input
                      type="text"
                      className="input num"
                      value={addAvatarColor}
                      onChange={(e) => setAddAvatarColor(e.target.value)}
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                  <button type="submit" className="btn primary" style={{ flex: 1 }} disabled={isPending}>
                    {isPending ? "در حال ثبت..." : "ثبت مخاطب"}
                  </button>
                  <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setIsAddOpen(false)}>
                    انصراف
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال ویرایش کامل اطلاعات مخاطب */}
      {editingPerson && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 999,
            display: "grid",
            placeItems: "center",
          }}
        >
          <div className="card" style={{ width: "480px", maxHeight: "90vh", overflowY: "auto", backgroundColor: "var(--panel)" }}>
            <div className="card-head">
              <h2>
                ویرایش اطلاعات مخاطب: {editingPerson.firstName} {editingPerson.lastName}
              </h2>
              <span className="spacer" />
              <button className="btn sm" onClick={() => setEditingPerson(null)}>
                بستن
              </button>
            </div>
            <form onSubmit={handleSavePhonebook}>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {error && <div className="err" style={{ color: "#ef4444", fontSize: "13px" }}>{error}</div>}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="field">
                    <label>نام *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>نام خانوادگی *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="field">
                    <label>کد پرسنلی</label>
                    <input
                      type="text"
                      className="input num"
                      value={editPersonnelCode}
                      onChange={(e) => setEditPersonnelCode(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>شیفت کاری</label>
                    <select
                      className="input"
                      value={editShift}
                      onChange={(e) => setEditShift(Number(e.target.value))}
                    >
                      {Object.entries(shifts).map(([val, name]) => (
                        <option key={val} value={val}>
                          شیفت {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>سمت سازمانی</label>
                  <select
                    className="input"
                    value={editOrgPosition}
                    onChange={(e) => setEditOrgPosition(Number(e.target.value))}
                  >
                    {Object.entries(positions).map(([val, name]) => (
                      <option key={val} value={val}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="field">
                    <label>شماره همراه ۱</label>
                    <input
                      type="text"
                      className="input num"
                      value={editPhone1}
                      onChange={(e) => setEditPhone1(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>شماره همراه ۲</label>
                    <input
                      type="text"
                      className="input num"
                      value={editPhone2}
                      onChange={(e) => setEditPhone2(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field">
                  <label>شماره داخلی پایانه</label>
                  <input
                    type="text"
                    className="input num"
                    value={editInternalTel}
                    onChange={(e) => setEditInternalTel(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>آدرس منزل</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>رنگ دلخواه آواتار</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="color"
                      value={editAvatarColor}
                      onChange={(e) => setEditAvatarColor(e.target.value)}
                      style={{ width: "40px", height: "40px", padding: 0, border: "0", cursor: "pointer", borderRadius: "4px" }}
                    />
                    <input
                      type="text"
                      className="input num"
                      value={editAvatarColor}
                      onChange={(e) => setEditAvatarColor(e.target.value)}
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                  <button type="submit" className="btn primary" style={{ flex: 1 }} disabled={isPending}>
                    {isPending ? "در حال ذخیره‌سازی..." : "ذخیره تغییرات"}
                  </button>
                  <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setEditingPerson(null)}>
                    انصراف
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deletePersonTarget)}
        title="حذف مخاطب"
        message={`آیا از حذف مخاطب «${deletePersonTarget?.firstName ?? ""} ${deletePersonTarget?.lastName ?? ""}» اطمینان دارید؟`}
        confirmText="حذف مخاطب"
        cancelText="انصراف"
        variant="danger"
        isLoading={isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletePersonTarget(null)}
      />

      {/* مدال تعاملی مدیریت تعارضات و موارد تکراری اکسل */}
      <ExcelConflictModal
        isOpen={conflictModalOpen}
        conflicts={conflictsList}
        nonConflicting={nonConflictingList}
        isSubmitting={isSubmittingImport}
        onConfirm={handleConfirmConflictResolution}
        onCancel={() => setConflictModalOpen(false)}
      />

      {/* مدال گزارش آماری پس از درون‌ریزی اکسل */}
      <ExcelImportSummaryModal
        isOpen={summaryModalOpen}
        summary={importSummary}
        onClose={() => setSummaryModalOpen(false)}
      />

      {/* مدال اختصاصی شناسنامه جامع پرسنل با فونت درشت و خوانا */}
      <PersonnelDetailModal
        isOpen={Boolean(detailPerson)}
        personnel={detailPerson}
        onClose={() => setDetailPerson(null)}
        shifts={shifts}
        positions={positions}
        canEdit={canEdit}
        onEdit={(p) => handleEditClick(p)}
      />
    </div>
  );
}
