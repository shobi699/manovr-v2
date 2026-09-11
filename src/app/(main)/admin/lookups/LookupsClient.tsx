"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLookupValue, deleteLookupValue } from "@/app/actions/lookups";
import DataTable, { Column } from "@/components/DataTable";

import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface LookupValue {
  id: number;
  code: number;
  label: string;
  color: string | null;
  icon: string | null;
  isActive: boolean;
  sortIdx: number;
  meta?: string;
}

interface LookupType {
  id: number;
  key: string;
  label: string;
  isSystem: boolean;
  values: LookupValue[];
}

interface LookupsClientProps {
  initialTypes: LookupType[];
}

export default function LookupsClient({ initialTypes }: LookupsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [types, setTypes] = useState<LookupType[]>(initialTypes);
  const [selectedTypeId, setSelectedTypeId] = useState<number>(initialTypes[0]?.id || 0);
  const [isPending, startTransition] = useTransition();

  const [editValue, setEditValue] = useState<Partial<LookupValue> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [valToDelete, setValToDelete] = useState<LookupValue | null>(null);

  const selectedType = types.find((t) => t.id === selectedTypeId);

  const handleEditClick = (val: LookupValue) => {
    setEditValue({ ...val });
    setIsNew(false);
  };

  const handleNewClick = () => {
    if (!selectedType) return;
    const maxCode = selectedType.values.reduce((max, v) => (v.code > max ? v.code : max), 0);
    const maxSort = selectedType.values.reduce((max, v) => (v.sortIdx > max ? v.sortIdx : max), 0);
    
    const nextCode = selectedType.key === "manovr_type" ? Math.max(30, maxCode + 1) : maxCode + 1;

    setEditValue({
      code: nextCode,
      label: "",
      color: "#64748b",
      icon: "",
      isActive: true,
      sortIdx: maxSort + 1,
      meta: "{}",
    });
    setIsNew(true);
  };

  const handleDeleteClick = (val: LookupValue) => {
    if (!selectedType) return;
    setValToDelete(val);
  };

  const confirmDeleteAction = async () => {
    if (!selectedType || !valToDelete) return;
    const val = valToDelete;
    setValToDelete(null);

    startTransition(async () => {
      const res = await deleteLookupValue(selectedType.id, val.code);
      if (res.ok) {
        setTypes((prev) =>
          prev.map((t) => {
            if (t.id !== selectedType.id) return t;
            return {
              ...t,
              values: t.values.filter((v) => v.code !== val.code),
            };
          })
        );
        if (editValue?.code === val.code) {
          setEditValue(null);
        }
        router.refresh();
        toast.success("مقدار با موفقیت حذف شد.");
      } else {
        toast.error(res.error || "خطا در حذف مقدار");
      }
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !editValue || editValue.code === undefined || !editValue.label) return;

    startTransition(async () => {
      const res = await saveLookupValue({
        typeId: selectedType.id,
        code: editValue.code!,
        label: editValue.label!,
        color: editValue.color ?? null,
        icon: editValue.icon ?? null,
        isActive: editValue.isActive ?? true,
        sortIdx: editValue.sortIdx ?? 0,
        meta: editValue.meta,
      });

      if (res.ok) {
        // به‌روزرسانی استیت محلی
        setTypes((prev) =>
          prev.map((t) => {
            if (t.id !== selectedType.id) return t;
            const exists = t.values.some((v) => v.code === editValue.code);
            const newValues = exists
              ? t.values.map((v) => (v.code === editValue.code ? (res.data as any) : v))
              : [...t.values, res.data as any];
            return {
              ...t,
              values: newValues.sort((a, b) => a.sortIdx - b.sortIdx),
            };
          })
        );
        setEditValue(null);
        router.refresh();
        toast.success("تغییرات با موفقیت ذخیره شد.");
      } else {
        toast.error(res.error || "خطا در ذخیره‌سازی");
      }
    });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "24px", alignItems: "start" }}>
      
      {/* سایدبار دسته‌بندی‌ها */}
      <div className="card" style={{ padding: "16px" }}>
        <h3 style={{ marginBottom: "16px", fontSize: "14px", fontWeight: "bold" }}>دسته‌بندی مقادیر</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {types.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSelectedTypeId(t.id);
                setEditValue(null);
              }}
              className={`btn ${selectedTypeId === t.id ? "primary" : "outline"}`}
              style={{
                textAlign: "right",
                justifyContent: "flex-start",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "13px",
              }}
            >
              <span>📂 {t.label}</span>
              <span className="muted" style={{ fontSize: "10px", marginInlineStart: "auto" }}>
                ({t.values.length} مقدار)
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* بخش اصلی نمایش و ویرایش مقادیر */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {selectedType && (
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: "bold" }}>مدیریت مقادیر: {selectedType.label}</h2>
                <p className="muted" style={{ fontSize: "12px", marginTop: "4px" }}>
                  کد ماشینی دسته: <code className="num">{selectedType.key}</code>
                </p>
              </div>
              <button onClick={handleNewClick} className="btn primary sm">
                ＋ افزودن مقدار جدید
              </button>
            </div>

            {/* جدول مقادیر */}
            <div className="table-w">
              <DataTable
                tableName="adminLookups"
                columns={[
                  { key: "code", label: "کد (ID)", sortable: true, filterable: true, render: (v) => <span className="num">{v.code}</span> },
                  { 
                    key: "label", 
                    label: "عنوان فارسی", 
                    sortable: true, 
                    filterable: true, 
                    render: (v) => (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", opacity: v.isActive ? 1 : 0.5 }}>
                        {v.color && (
                          <span 
                            style={{ 
                              width: "12px", 
                              height: "12px", 
                              borderRadius: "50%", 
                              backgroundColor: v.color,
                              border: "1px solid var(--line)"
                            }} 
                          />
                        )}
                        <b>{v.label}</b>
                      </div>
                    )
                  },
                  ...(selectedType.key === "manovr_type" ? [{
                    key: "behavior",
                    label: "رفتار عملیاتی",
                    filterable: true,
                    getValue: (v: any) => {
                      let isStatic = false;
                      let isPermanent = false;
                      try {
                        const metaParsed = JSON.parse(v.meta || "{}");
                        isStatic = !!metaParsed.isStatic;
                        isPermanent = !!metaParsed.isPermanent || (v.code >= 21 && v.code <= 24);
                      } catch {}
                      return isPermanent ? "انتقال دائم" : isStatic ? "ثابت (در محل)" : "داینامیک (انتقال)";
                    },
                    render: (v: any) => {
                      let isStatic = false;
                      let isPermanent = false;
                      try {
                        const metaParsed = JSON.parse(v.meta || "{}");
                        isStatic = !!metaParsed.isStatic;
                        isPermanent = !!metaParsed.isPermanent || (v.code >= 21 && v.code <= 24);
                      } catch {}
                      
                      if (isPermanent) {
                        return <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", backgroundColor: "rgba(225, 29, 72, 0.15)", color: "#e11d48", border: "1px solid rgba(225, 29, 72, 0.3)", fontWeight: 600 }}>🛑 انتقال دائم</span>;
                      } else if (isStatic) {
                        return <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", backgroundColor: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", border: "1px solid rgba(59, 130, 246, 0.3)", fontWeight: 600 }}>⚡ ثابت (در محل)</span>;
                      } else {
                        return <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", backgroundColor: "rgba(148, 163, 184, 0.12)", color: "var(--fg-muted, #94a3b8)", border: "1px solid rgba(148, 163, 184, 0.2)", fontWeight: 600 }}>🚀 داینامیک (انتقال)</span>;
                      }
                    }
                  } as Column<any>] : []),
                  { key: "color", label: "رنگ نشان‌گر", filterable: true, render: (v) => <span className="num">{v.color || "—"}</span> },
                  { key: "sortIdx", label: "ترتیب نمایش", sortable: true, render: (v) => <span className="num">{v.sortIdx}</span> },
                  { 
                    key: "status", 
                    label: "وضعیت", 
                    filterable: true,
                    getValue: (v) => v.isActive ? "فعال" : "غیرفعال",
                    render: (v) => (
                      <span className={`pill ${v.isActive ? "p-good" : "p-mut"}`}>
                        {v.isActive ? "فعال" : "غیرفعال"}
                      </span>
                    )
                  },
                  {
                    key: "actions",
                    label: "اقدام",
                    render: (v) => (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => handleEditClick(v)} className="btn sm outline">
                          ✏️ ویرایش
                        </button>
                        {!selectedType.isSystem && (
                          <button onClick={() => handleDeleteClick(v)} className="btn sm outline text-crit" style={{ borderColor: "rgba(239, 68, 68, 0.3)" }}>
                            🗑️ حذف
                          </button>
                        )}
                      </div>
                    )
                  }
                ]}
                data={selectedType.values}
                searchFields={["label", "code"]}
              />
            </div>
          </div>
        )}

        {/* مدال افزودن / ویرایش مقادیر پویا */}
        {editValue && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              backgroundColor: "rgba(15, 23, 42, 0.75)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditValue(null);
            }}
          >
            <div
              className="card"
              style={{
                maxWidth: "540px",
                width: "100%",
                padding: "24px",
                borderRadius: "16px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
                border: "1px solid var(--line)",
                backgroundColor: "var(--panel, #1e293b)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                  borderBottom: "1px solid var(--line-soft)",
                  paddingBottom: "12px",
                }}
              >
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>
                    {isNew ? "＋ افزودن مقدار جدید به لوکاپ" : `✏️ ویرایش مقدار لوکاپ (کد ${editValue.code})`}
                  </h3>
                  <p className="muted" style={{ fontSize: "12px", marginTop: "4px", margin: 0 }}>
                    دسته: <b>{selectedType?.label}</b> (<code className="num">{selectedType?.key}</code>)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditValue(null)}
                  className="btn sm outline"
                  style={{ borderRadius: "50%", width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSave} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label className="label">کد عددی (غیرقابل تغییر پس از ایجاد)</label>
                  <input
                    type="number"
                    required
                    disabled={!isNew}
                    className="input num"
                    value={editValue.code ?? ""}
                    onChange={(e) => setEditValue((prev) => ({ ...prev, code: parseInt(e.target.value) || 0 }))}
                  />
                </div>

                <div>
                  <label className="label">عنوان فارسی *</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="عنوان مقدار..."
                    value={editValue.label ?? ""}
                    onChange={(e) => setEditValue((prev) => ({ ...prev, label: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="label">کد رنگ (Hex Code)</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="color"
                      style={{ width: "42px", height: "42px", padding: 0, border: "none", cursor: "pointer", borderRadius: "6px" }}
                      value={editValue.color ?? "#64748b"}
                      onChange={(e) => setEditValue((prev) => ({ ...prev, color: e.target.value }))}
                    />
                    <input
                      type="text"
                      className="input num"
                      placeholder="#ffffff"
                      value={editValue.color ?? ""}
                      onChange={(e) => setEditValue((prev) => ({ ...prev, color: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">ترتیب نمایش (اولویت)</label>
                  <input
                    type="number"
                    required
                    className="input num"
                    value={editValue.sortIdx ?? ""}
                    onChange={(e) => setEditValue((prev) => ({ ...prev, sortIdx: parseInt(e.target.value) || 0 }))}
                  />
                </div>

                {selectedType?.key === "manovr_type" && (() => {
                  let metaObj: any = {};
                  try {
                    metaObj = JSON.parse(editValue.meta || "{}");
                  } catch {}

                  return (
                    <div
                      style={{
                        gridColumn: "span 2",
                        padding: "12px 14px",
                        borderRadius: "10px",
                        backgroundColor: "rgba(59, 130, 246, 0.08)",
                        border: "1px solid rgba(59, 130, 246, 0.2)",
                        margin: "4px 0",
                      }}
                    >
                      <label className="label" style={{ fontWeight: 600, color: "var(--color-primary, #2563eb)", marginBottom: "6px", display: "block" }}>
                        رفتار عملیاتی این نوع مانور:
                      </label>
                      <div style={{ display: "flex", gap: "14px", marginTop: "6px", flexWrap: "wrap" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px" }}>
                          <input
                            type="radio"
                            name="behaviorRadio"
                            checked={!metaObj.isStatic && !metaObj.isPermanent}
                            onChange={() => {
                              const updated = { ...metaObj, isStatic: false, isPermanent: false };
                              setEditValue((prev) => ({ ...prev, meta: JSON.stringify(updated) }));
                            }}
                          />
                          <span>🚀 <b>مانور داینامیک</b> (جابه‌جایی به ریل دیگر)</span>
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px" }}>
                          <input
                            type="radio"
                            name="behaviorRadio"
                            checked={!!metaObj.isStatic}
                            onChange={() => {
                              const updated = { ...metaObj, isStatic: true, isPermanent: false };
                              setEditValue((prev) => ({ ...prev, meta: JSON.stringify(updated) }));
                            }}
                          />
                          <span>⚡ <b>مانور در محل / ثابت</b> (روی همان خط)</span>
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px" }}>
                          <input
                            type="radio"
                            name="behaviorRadio"
                            checked={!!metaObj.isPermanent}
                            onChange={() => {
                              const updated = { ...metaObj, isStatic: false, isPermanent: true };
                              setEditValue((prev) => ({ ...prev, meta: JSON.stringify(updated) }));
                            }}
                          />
                          <span>🛑 <b>انتقال دائم</b> (خروج قطار از پایانه)</span>
                        </label>
                      </div>
                    </div>
                  );
                })()}

                <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={editValue.isActive ?? true}
                    onChange={(e) => setEditValue((prev) => ({ ...prev, isActive: e.target.checked }))}
                  />
                  <label htmlFor="isActive" style={{ cursor: "pointer" }}>
                    <b>این مقدار فعال باشد و در منوها نشان داده شود.</b>
                    <p className="muted" style={{ fontSize: "11px", margin: 0 }}>
                      غیرفعالسازی نرم تضمین می‌کند که داده‌های تاریخی آسیب نبینند.
                    </p>
                  </label>
                </div>

                <div style={{ gridColumn: "span 2", display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px", borderTop: "1px solid var(--line-soft)", paddingTop: "14px" }}>
                  <button 
                    type="button" 
                    onClick={() => setEditValue(null)} 
                    className="btn outline"
                  >
                    انصراف
                  </button>
                  <button 
                    type="submit" 
                    disabled={isPending} 
                    className="btn primary"
                  >
                    {isPending ? "در حال ذخیره‌سازی..." : "💾 ذخیره تغییرات"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* مدال تایید حذف */}
      <ConfirmModal
        isOpen={!!valToDelete}
        title="حذف مقدار لوکاپ"
        message={`آیا از حذف مقدار "${valToDelete?.label}" اطمینان دارید؟`}
        confirmText="حذف مقدار"
        cancelText="انصراف"
        variant="danger"
        isLoading={isPending}
        onConfirm={confirmDeleteAction}
        onCancel={() => setValToDelete(null)}
      />
    </div>
  );
}
