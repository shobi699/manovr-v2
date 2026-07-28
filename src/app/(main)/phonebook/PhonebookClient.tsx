"use client";

import React, { useState, useTransition } from "react";
import { updatePersonnelPhoneInfo, importPersonnelFromExcel } from "@/app/actions/user";

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
  canEdit,
  shifts,
  positions,
}: {
  initialPersonnel: PersonnelItem[];
  canEdit: boolean;
  shifts: Record<number, string>;
  positions: Record<number, string>;
}) {
  const [list, setList] = useState(initialPersonnel);
  const [search, setSearch] = useState("");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [posFilter, setPosFilter] = useState("all");
  const [editingPerson, setEditingPerson] = useState<PersonnelItem | null>(null);
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
    } catch (error) {
      console.error(error);
      alert("خطا در خروجی گرفتن اکسل.");
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
        userName: "karimi99",
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
          alert("هیچ داده معتبری در فایل پیدا نشد.");
          return;
        }

        const res = await importPersonnelFromExcel(rows);
        if (res.error) {
          alert(res.error);
        } else {
          alert(`تعداد ${res.count} پرسنل جدید با موفقیت درج شدند.`);
          window.location.reload();
        }
      } catch (err) {
        console.error(err);
        alert("فرمت فایل اکسل معتبر نیست یا خطا در خواندن رخ داد.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // فرم موقت برای مودال ویرایش
  const [phone1, setPhone1] = useState("");
  const [phone2, setPhone2] = useState("");
  const [internalTel, setInternalTel] = useState("");
  const [address, setAddress] = useState("");
  const [avatarColor, setAvatarColor] = useState("");

  const handleEditClick = (p: PersonnelItem) => {
    setEditingPerson(p);
    setPhone1(p.phone1);
    setPhone2(p.phone2);
    setInternalTel(p.internalTel);
    setAddress(p.address);
    setAvatarColor(p.avatarColor);
    setError(null);
  };

  const handleSavePhonebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson) return;
    setError(null);

    const fd = new FormData();
    fd.append("id", String(editingPerson.id));
    fd.append("phone1", phone1);
    fd.append("phone2", phone2);
    fd.append("internalTel", internalTel);
    fd.append("address", address);
    fd.append("avatarColor", avatarColor);

    startTransition(async () => {
      const res = await updatePersonnelPhoneInfo(null, fd);
      if (res?.error) {
        setError(res.error);
      } else {
        // بروزرسانی لوکال لیست
        setList((prev) =>
          prev.map((item) =>
            item.id === editingPerson.id
              ? { ...item, phone1, phone2, internalTel, address, avatarColor }
              : item
          )
        );
        setEditingPerson(null);
      }
    });
  };

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    alert(`${label} در حافظه کپی شد: ${text}`);
  };

  const filtered = list.filter((p) => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    const matchesSearch =
      fullName.includes(search.toLowerCase()) ||
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
          placeholder="جستجو بر اساس نام، شماره تلفن، داخلی..."
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

      {/* عملیات اکسل */}
      <div className="card" style={{ padding: "16px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
        <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--ink)" }}>عملیات اکسل:</span>
        
        <button onClick={handleExportExcel} className="btn primary sm" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "16px" }}>📥</span> خروجی اکسل دفتر تلفن
        </button>
        
        {canEdit && (
          <>
            <label className="btn sm" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", margin: 0, padding: "8px 12px", border: "1px solid var(--line)" }}>
              <span style={{ fontSize: "16px" }}>📤</span> بارگذاری اکسل پرسنل
              <input type="file" accept=".xlsx" onChange={handleExcelImport} style={{ display: "none" }} />
            </label>
            
            <button onClick={handleDownloadSample} className="btn sm" style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "transparent", border: "1px dashed var(--line)" }}>
              <span style={{ fontSize: "16px" }}>📄</span> دانلود نمونه اکسل ورودی
            </button>
          </>
        )}
      </div>

      {/* نمایش کارتی پرسنل */}
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
                    backgroundColor: p.avatarColor || "var(--accent)",
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
                <div style={{ padding: "8px 18px", borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "flex-end" }}>
                  <button className="btn sm" onClick={() => handleEditClick(p)}>
                    ویرایش تماس
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* مودال ویرایش اطلاعات تماس */}
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
          <div className="card" style={{ width: "450px", backgroundColor: "var(--panel)" }}>
            <div className="card-head">
              <h2>
                ویرایش اطلاعات تماس: {editingPerson.firstName} {editingPerson.lastName}
              </h2>
              <span className="spacer" />
              <button className="btn sm" onClick={() => setEditingPerson(null)}>
                بستن
              </button>
            </div>
            <form onSubmit={handleSavePhonebook}>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {error && <div className="err">{error}</div>}

                <div className="field">
                  <label>شماره همراه ۱</label>
                  <input
                    type="text"
                    className="input num"
                    value={phone1}
                    onChange={(e) => setPhone1(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>شماره همراه ۲</label>
                  <input
                    type="text"
                    className="input num"
                    value={phone2}
                    onChange={(e) => setPhone2(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>شماره داخلی پایانه</label>
                  <input
                    type="text"
                    className="input num"
                    value={internalTel}
                    onChange={(e) => setInternalTel(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>آدرس منزل</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>رنگ دلخواه آواتار (Hex)</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="color"
                      value={avatarColor}
                      onChange={(e) => setAvatarColor(e.target.value)}
                      style={{ width: "40px", height: "40px", padding: 0, border: "0", cursor: "pointer", borderRadius: "4px" }}
                    />
                    <input
                      type="text"
                      className="input num"
                      value={avatarColor}
                      onChange={(e) => setAvatarColor(e.target.value)}
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
    </div>
  );
}
