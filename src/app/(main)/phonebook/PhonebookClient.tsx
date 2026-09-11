"use client";

import React, { useState, useTransition } from "react";
import {
  createPhonebookContact,
  updatePersonnelPhoneInfo,
  deletePhonebookContact,
  importPersonnelFromExcel,
} from "@/app/actions/user";
import type { ListParams } from "@/lib/list-query";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

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
  const [list, setList] = useState(initialPersonnel);
  const [search, setSearch] = useState("");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [posFilter, setPosFilter] = useState("all");
  const [deletePersonTarget, setDeletePersonTarget] = useState<PersonnelItem | null>(null);
  const { toast } = useToast();

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

        const rows: any[] = [];
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

        const res = await importPersonnelFromExcel(rows);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(`تعداد ${res.count} مخاطب جدید با موفقیت درج شدند.`);
          window.location.reload();
        }
      } catch (err) {
        console.error(err);
        toast.error("فرمت فایل اکسل معتبر نیست یا خطا در خواندن رخ داد.");
      }
    };
    reader.readAsArrayBuffer(file);
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
      }
    });
  };

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} در حافظه کپی شد: ${text}`);
  };

  const filtered = list.filter((p) => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    const code = p.personnelCode ? p.personnelCode.toLowerCase() : "";
    const matchesSearch =
      fullName.includes(search.toLowerCase()) ||
      code.includes(search.toLowerCase()) ||
      p.phone1.includes(search) ||
      p.phone2.includes(search) ||
      p.internalTel.includes(search);

    const matchesShift = shiftFilter === "all" || String(p.shift) === shiftFilter;
    const matchesPos = posFilter === "all" || String(p.orgPosition) === posFilter;

    return matchesSearch && matchesShift && matchesPos;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* بخش جستجو و فیلتر */}
      <div className="toolbar" style={{ backgroundColor: "var(--panel)", padding: "16px", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>
        <input
          type="text"
          placeholder="جستجو بر اساس نام، کد پرسنلی، شماره تلفن، داخلی..."
          className="input search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: "400px" }}
        />
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
        <span className="spacer" />
        <div className="muted" style={{ fontSize: 13, fontWeight: 650 }}>
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
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {filtered.map((p) => (
            <div className="card" key={p.id} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div className="card-body" style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                {/* آواتار */}
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    backgroundColor: p.avatarColor || "#2563eb",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "18px",
                    fontWeight: "bold",
                    flexShrink: 0,
                  }}
                >
                  {p.firstName[0]}
                </div>
                {/* اطلاعات کلی */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: "15px", fontWeight: "bold", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.firstName} {p.lastName}
                  </h3>
                  <div style={{ display: "flex", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                    {p.personnelCode && (
                      <span className="pill p-mut" style={{ fontSize: "10px" }}>
                        کد: {p.personnelCode}
                      </span>
                    )}
                    <span className="pill p-rail" style={{ fontSize: "10px" }}>
                      {positions[p.orgPosition] || "سایر"}
                    </span>
                    <span className="pill p-mut" style={{ fontSize: "10px" }}>
                      شیفت {shifts[p.shift] || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* بخش شماره تلفن‌ها */}
              <div
                style={{
                  borderTop: "1px solid var(--line-soft)",
                  padding: "12px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  fontSize: "13px",
                  backgroundColor: "var(--panel-2)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="muted">تلفن همراه ۱:</span>
                  {p.phone1 ? (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span className="num">{p.phone1}</span>
                      <button
                        className="btn sm"
                        style={{ padding: "1px 6px", fontSize: "10px" }}
                        onClick={() => handleCopy(p.phone1, "تلفن همراه ۱")}
                      >
                        کپی
                      </button>
                    </div>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="muted">تلفن همراه ۲:</span>
                  {p.phone2 ? (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span className="num">{p.phone2}</span>
                      <button
                        className="btn sm"
                        style={{ padding: "1px 6px", fontSize: "10px" }}
                        onClick={() => handleCopy(p.phone2, "تلفن همراه ۲")}
                      >
                        کپی
                      </button>
                    </div>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="muted">تلفن داخلی:</span>
                  {p.internalTel ? (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span className="num" style={{ fontWeight: "bold", color: "var(--accent-ink)" }}>
                        {p.internalTel}
                      </span>
                      <button
                        className="btn sm"
                        style={{ padding: "1px 6px", fontSize: "10px" }}
                        onClick={() => handleCopy(p.internalTel, "تلفن داخلی")}
                      >
                        کپی
                      </button>
                    </div>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </div>

                {p.address && (
                  <div style={{ fontSize: "11.5px", marginTop: "4px", borderTop: "1px dashed var(--line)", paddingTop: "4px" }}>
                    <span className="muted">آدرس:</span> {p.address}
                  </div>
                )}
              </div>

              {canEdit && (
                <div style={{ padding: "8px 18px", borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button
                    className="btn sm"
                    style={{ fontSize: "11px", color: "#ef4444", border: "1px solid var(--line)" }}
                    onClick={() => handleDeleteClick(p)}
                    disabled={isPending}
                  >
                    حذف
                  </button>
                  <button className="btn sm" onClick={() => handleEditClick(p)}>
                    ویرایش کامل
                  </button>
                </div>
              )}
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
    </div>
  );
}
