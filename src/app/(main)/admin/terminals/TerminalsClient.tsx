"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLookupValue, deleteLookupValue } from "@/app/actions/lookups";
import PageHeader from "@/components/PageHeader";
import { Icons } from "@/lib/icons";

interface TerminalItem {
  id: number;
  typeId: number;
  code: number;
  label: string;
  color: string | null;
  icon: string | null;
  isActive: boolean;
  sortIdx: number;
  meta: string;
}

interface LineItem {
  id: number;
  name: string;
  terminal: number;
}

export default function TerminalsClient({
  typeId,
  initialTerminals,
  lines,
}: {
  typeId: number;
  initialTerminals: TerminalItem[];
  lines: LineItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [terminals, setTerminals] = useState<TerminalItem[]>(initialTerminals);
  const [editingItem, setEditingItem] = useState<TerminalItem | null>(null);
  const [isNew, setIsNew] = useState(false);

  // فیلدهای فرم ویرایش/ایجاد
  const [code, setCode] = useState<number>(1);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#cbd5e1");
  const [posX, setPosX] = useState<number>(0);
  const [posZ, setPosZ] = useState<number>(0);
  const [gridCol, setGridCol] = useState<number>(1);
  const [gridRow, setGridRow] = useState<string>("full");

  const handleEditClick = (t: TerminalItem) => {
    let meta: any = {};
    try {
      meta = JSON.parse(t.meta || "{}");
    } catch {}

    setEditingItem(t);
    setIsNew(false);
    setCode(t.code);
    setLabel(t.label);
    setColor(t.color || "#cbd5e1");
    setPosX(typeof meta.x === "number" ? meta.x : 0);
    setPosZ(typeof meta.z === "number" ? meta.z : 0);
    setGridCol(typeof meta.gridCol === "number" ? meta.gridCol : 1);
    setGridRow(meta.gridRow || "full");
  };

  const handleNewClick = () => {
    const nextCode = terminals.length > 0 ? Math.max(...terminals.map((t) => t.code)) + 1 : 1;
    setEditingItem(null);
    setIsNew(true);
    setCode(nextCode);
    setLabel("");
    setColor("#3b82f6");
    setPosX(0);
    setPosZ(0);
    setGridCol(1);
    setGridRow("full");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return alert("لطفاً عنوان ترمینال را وارد کنید.");

    const metaObj = {
      x: Number(posX),
      z: Number(posZ),
      gridCol: Number(gridCol),
      gridRow: gridRow,
    };

    startTransition(async () => {
      const res = await saveLookupValue({
        typeId,
        code,
        label,
        color,
        isActive: true,
        sortIdx: code,
        meta: JSON.stringify(metaObj),
      });

      if (!res.ok) {
        alert(res.error || "خطا در ثبت اطلاعات");
      } else {
        alert("اطلاعات ترمینال با موفقیت ثبت شد.");
        setEditingItem(null);
        setIsNew(false);
        router.refresh();
        // بروزرسانی لوکال لیست
        const updated = res.data as TerminalItem;
        setTerminals((prev) => {
          const exists = prev.some((x) => x.code === updated.code);
          if (exists) {
            return prev.map((x) => (x.code === updated.code ? updated : x));
          }
          return [...prev, updated].sort((a, b) => a.code - b.code);
        });
      }
    });
  };

  const handleDelete = async (t: TerminalItem) => {
    if (!confirm(`آیا از حذف ترمینال "${t.label}" اطمینان دارید؟`)) return;

    startTransition(async () => {
      const res = await deleteLookupValue(typeId, t.code);
      if (!res.ok) {
        alert(res.error || "خطا در حذف ترمینال");
      } else {
        alert("ترمینال با موفقیت حذف شد.");
        setTerminals((prev) => prev.filter((x) => x.code !== t.code));
        router.refresh();
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", direction: "rtl" }}>
      <PageHeader
        title="مدیریت و مهندسی ترمینال‌های پایانه"
        breadcrumb={[{ label: "تحلیل و تنظیمات" }, { label: "مدیریت ترمینال‌ها" }]}
        actions={
          <button className="btn primary" onClick={handleNewClick}>
            <Icons.NewManovr size={14} style={{ marginInlineEnd: 4 }} />
            افزودن ترمینال جدید
          </button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: editingItem || isNew ? "1.5fr 1fr" : "1fr", gap: "20px", transition: "var(--transition-fluid)" }}>
        {/* لیست ترمینال‌ها */}
        <div className="card" style={{ padding: "20px" }}>
          <div style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "16px", color: "var(--ink-soft)" }}>
            ترمینال‌های فعال در نمای پایانه (۲بعدی و ۳بعدی)
          </div>
          <table className="data" style={{ width: "100%", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--line)" }}>
                <th>کد</th>
                <th>رنگ شناسایی</th>
                <th>نام ترمینال</th>
                <th>موقعیت سه‌بعدی (X, Z)</th>
                <th>ستون ۲بعدی</th>
                <th>ردیف ۲بعدی</th>
                <th style={{ textAlign: "center" }}>تعداد خطوط ریل</th>
                <th style={{ textAlign: "center" }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {terminals.map((t) => {
                let meta: any = {};
                try {
                  meta = JSON.parse(t.meta || "{}");
                } catch {}

                const connectedLines = lines.filter((l) => l.terminal === t.code);

                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                    <td className="num" style={{ fontWeight: "bold" }}>{t.code}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            width: "14px",
                            height: "14px",
                            borderRadius: "50%",
                            backgroundColor: t.color || "#cbd5e1",
                            border: "1px solid var(--line)",
                          }}
                        />
                        <code className="num" style={{ fontSize: "11px" }}>{t.color || "—"}</code>
                      </div>
                    </td>
                    <td style={{ fontWeight: "bold" }}>{t.label}</td>
                    <td className="num">
                      X: {meta.x ?? 0} | Z: {meta.z ?? 0}
                    </td>
                    <td className="num">ستون {meta.gridCol ?? 1}</td>
                    <td>
                      {meta.gridRow === "top" ? "بالا (Top)" : meta.gridRow === "bottom" ? "پایین (Bottom)" : "کامل (Full)"}
                    </td>
                    <td className="num" style={{ textAlign: "center", fontWeight: "bold" }}>
                      {connectedLines.length}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "inline-flex", gap: "8px" }}>
                        <button className="btn sm outline" onClick={() => handleEditClick(t)}>
                          <Icons.Edit size={12} style={{ marginInlineEnd: 4 }} />
                          ویرایش
                        </button>
                        <button
                          className="btn sm outline text-crit"
                          style={{ borderColor: "rgba(239, 68, 68, 0.2)" }}
                          onClick={() => handleDelete(t)}
                        >
                          <Icons.Trash size={12} style={{ marginInlineEnd: 4 }} />
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {terminals.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "30px", color: "var(--ink-faint)" }}>
                    هیچ ترمینالی تعریف نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* سایدبار ادیتور ترمینال */}
        {(editingItem || isNew) && (
          <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px", alignSelf: "start" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "10px" }}>
              <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                {isNew ? "ایجاد ترمینال جدید" : `ویرایش ترمینال ${editingItem?.label}`}
              </div>
              <button
                className="btn sm"
                style={{ padding: "4px 8px" }}
                onClick={() => {
                  setEditingItem(null);
                  setIsNew(false);
                }}
              >
                انصراف
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="field">
                <label>کد ترمینال *</label>
                <input
                  type="number"
                  className="input num"
                  value={code}
                  onChange={(e) => setCode(Number(e.target.value))}
                  disabled={!isNew}
                  required
                />
                {isNew && <span style={{ fontSize: "10px", color: "var(--ink-soft)" }}>کد شناسایی دیتابیسی (یکتا)</span>}
              </div>

              <div className="field">
                <label>عنوان ترمینال (فارسی) *</label>
                <input
                  type="text"
                  className="input"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="مثال: پارکینگ غربی"
                  required
                />
              </div>

              <div className="field">
                <label>رنگ نشانگر ترمینال (Hex Color)</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    style={{ width: "38px", height: "38px", padding: 0, border: "1px solid var(--line)", borderRadius: "4px", cursor: "pointer" }}
                  />
                  <input
                    type="text"
                    className="input num"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#3b82f6"
                    style={{ flex: 1 }}
                    required
                  />
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: "12px", marginTop: "4px" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "var(--accent)" }}>تنظیمات قرارگیری در نقشه و صحنه:</span>
              </div>

              <div className="grid2">
                <div className="field">
                  <label>موقعیت X در ۳بعدی</label>
                  <input
                    type="number"
                    className="input num"
                    value={posX}
                    onChange={(e) => setPosX(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="field">
                  <label>موقعیت Z در ۳بعدی</label>
                  <input
                    type="number"
                    className="input num"
                    value={posZ}
                    onChange={(e) => setPosZ(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="grid2">
                <div className="field">
                  <label>ستون در نمای ۲بعدی</label>
                  <select
                    className="input num"
                    value={gridCol}
                    onChange={(e) => setGridCol(Number(e.target.value))}
                    required
                  >
                    <option value="1">ستون ۱ (راست‌ترین)</option>
                    <option value="2">ستون ۲</option>
                    <option value="3">ستون ۳ (وسط)</option>
                    <option value="4">ستون ۴</option>
                    <option value="5">ستون ۵ (چپ‌ترین)</option>
                  </select>
                </div>
                <div className="field">
                  <label>ردیف در نمای ۲بعدی</label>
                  <select
                    className="input"
                    value={gridRow}
                    onChange={(e) => setGridRow(e.target.value)}
                    required
                  >
                    <option value="full">کامل (تمام قد)</option>
                    <option value="top">بالا (نیمه بالا)</option>
                    <option value="bottom">پایین (نیمه پایین)</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="btn primary" style={{ width: "100%", marginTop: "10px" }} disabled={isPending}>
                {isPending ? "در حال ذخیره‌سازی..." : "💾 ثبت مشخصات ترمینال"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
