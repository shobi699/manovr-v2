"use client";

import React, { useState, useTransition } from "react";
import { createRole, updateRole, deleteRole } from "@/app/actions/role";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

export default function RolesFormClient({
  mode,
  roleId,
  roleName = "",
  activePerms = [],
  allPerms = [],
  permLabels = {},
  isSystem = false,
  canEdit = true,
  canDelete = true,
}: {
  mode: "create" | "edit";
  roleId?: number;
  roleName?: string;
  activePerms?: string[];
  allPerms: readonly string[];
  permLabels: Record<string, string>;
  isSystem?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(roleName);
  const [selectedPerms, setSelectedPerms] = useState<string[]>(activePerms);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();

  const handleTogglePerm = (perm: string) => {
    setSelectedPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const groupedPerms = React.useMemo(() => {
    const groups: Record<string, string[]> = {};
    allPerms.forEach((perm) => {
      const category = perm.split(".")[0];
      if (!groups[category]) groups[category] = [];
      groups[category].push(perm);
    });
    return groups;
  }, [allPerms]);

  const toggleCategory = (category: string, perms: string[]) => {
    const allSelected = perms.every((p) => selectedPerms.includes(p));
    if (allSelected) {
      setSelectedPerms((prev) => prev.filter((p) => !perms.includes(p)));
    } else {
      setSelectedPerms((prev) => Array.from(new Set([...prev, ...perms])));
    }
  };

  const renderPermsList = (maxHeight = "350px") => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        maxHeight,
        overflowY: "auto",
        padding: "8px",
        border: "1px solid var(--line)",
        borderRadius: "6px",
        background: "rgba(0, 0, 0, 0.02)",
      }}
    >
      {Object.entries(groupedPerms).map(([category, perms]) => {
        const allSelected = perms.every((p) => selectedPerms.includes(p));
        const someSelected = perms.some((p) => selectedPerms.includes(p));

        return (
          <div key={category} style={{ borderBottom: "1px solid var(--line-soft)", paddingBottom: "8px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "6px",
                background: "var(--panel-2, rgba(0,0,0,0.03))",
                padding: "4px 8px",
                borderRadius: "4px",
              }}
            >
              <span style={{ fontWeight: "bold", fontSize: "13px" }}>
                گروه: {category.toUpperCase()}
              </span>
              <button
                type="button"
                className="btn sm"
                style={{ padding: "2px 6px", fontSize: "11px" }}
                onClick={() => toggleCategory(category, perms)}
              >
                {allSelected ? "لغو همه" : someSelected ? "انتخاب همه" : "انتخاب همه"}
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "6px", paddingRight: "8px" }}>
              {perms.map((p) => (
                <label
                  key={p}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "12px",
                    color: "var(--ink)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedPerms.includes(p)}
                    onChange={() => handleTogglePerm(p)}
                    style={{ cursor: "pointer" }}
                  />
                  <span>{permLabels[p] || p}</span>
                  <span className="muted" style={{ fontSize: "10px", marginRight: "auto" }}>
                    {p}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    if (roleId) fd.append("id", String(roleId));
    fd.append("name", name);
    selectedPerms.forEach((p) => fd.append("permissions", p));

    startTransition(async () => {
      const res = mode === "create" ? await createRole(null, fd) : await updateRole(null, fd);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        setIsOpen(false);
        toast.success(mode === "create" ? "نقش جدید با موفقیت ثبت شد." : "نقش با موفقیت به‌روزرسانی شد.");
        if (mode === "create") {
          setName("");
          setSelectedPerms([]);
        }
      }
    });
  };

  const handleConfirmDelete = async () => {
    if (!roleId) return;

    startTransition(async () => {
      const res = await deleteRole(roleId);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("نقش با موفقیت حذف شد.");
        setShowDeleteConfirm(false);
      }
    });
  };

  if (mode === "create") {
    return (
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {error && <div className="err">{error}</div>}
        <div className="field">
          <label>نام نقش (مثلاً: مسئول برنامه‌ریزی)</label>
          <input
            type="text"
            className="input"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label style={{ marginBottom: "8px" }}>مجوزها و دسترسی‌ها</label>
          {renderPermsList("300px")}
        </div>

        <button type="submit" className="btn primary" style={{ width: "100%" }} disabled={isPending}>
          {isPending ? "در حال ثبت..." : "ثبت نقش جدید"}
        </button>
      </form>
    );
  }

  return (
    <>
      {canEdit && (
        <button className="btn sm" onClick={() => setIsOpen(true)}>
          ویرایش نقش
        </button>
      )}
      {canDelete && !isSystem && (
        <button className="btn sm" style={{ color: "var(--crit)", borderColor: "var(--crit)" }} onClick={() => setShowDeleteConfirm(true)} disabled={isPending}>
          حذف
        </button>
      )}

      {isOpen && (
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
          <div
            className="card"
            style={{
              width: "480px",
              backgroundColor: "var(--panel)",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="card-head">
              <h2>ویرایش نقش: {roleName}</h2>
              <span className="spacer" />
              <button
                className="btn sm"
                onClick={() => setIsOpen(false)}
                style={{ padding: "4px 8px" }}
              >
                بستن
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ overflowY: "auto" }}>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {error && <div className="err">{error}</div>}
                <div className="field">
                  <label>نام نقش {isSystem && <span className="muted" style={{ fontSize: "11px", fontWeight: "normal" }}>(نام نقش‌های سیستمی قابل تغییر نیست)</span>}</label>
                  <input
                    type="text"
                    className="input"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isSystem}
                  />
                </div>

                <div className="field">
                  <label style={{ marginBottom: "8px" }}>مجوزها و دسترسی‌ها</label>
                  {renderPermsList("350px")}
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button type="submit" className="btn primary" style={{ flex: 1 }} disabled={isPending}>
                    {isPending ? "در حال به‌روزرسانی..." : "ذخیره تغییرات"}
                  </button>
                  <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setIsOpen(false)}>
                    انصراف
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="حذف نقش"
        message={`آیا از حذف نقش «${roleName}» اطمینان دارید؟`}
        confirmText="حذف نقش"
        cancelText="انصراف"
        variant="danger"
        isLoading={isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
