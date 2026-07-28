"use client";

import React, { useState, useTransition } from "react";
import { createRole, updateRole, deleteRole } from "@/app/actions/role";

export default function RolesFormClient({
  mode,
  roleId,
  roleName = "",
  activePerms = [],
  allPerms = [],
  permLabels = {},
  isSystem = false,
}: {
  mode: "create" | "edit";
  roleId?: number;
  roleName?: string;
  activePerms?: string[];
  allPerms: readonly string[];
  permLabels: Record<string, string>;
  isSystem?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(roleName);
  const [selectedPerms, setSelectedPerms] = useState<string[]>(activePerms);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleTogglePerm = (perm: string) => {
    setSelectedPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

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
      } else {
        setIsOpen(false);
        if (mode === "create") {
          setName("");
          setSelectedPerms([]);
        }
      }
    });
  };

  const handleDelete = async () => {
    if (!roleId) return;
    if (!confirm("آیا از حذف این نقش مطمئن هستید؟")) return;

    startTransition(async () => {
      const res = await deleteRole(roleId);
      if (res?.error) {
        alert(res.error);
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
          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              border: "1px solid var(--line)",
              borderRadius: "9px",
              padding: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {allPerms.map((perm) => (
              <label
                key={perm}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedPerms.includes(perm)}
                  onChange={() => handleTogglePerm(perm)}
                  style={{ accentColor: "var(--accent)" }}
                />
                <b>{perm}</b> · {permLabels[perm] || perm}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" className="btn primary" style={{ width: "100%" }} disabled={isPending}>
          {isPending ? "در حال ثبت..." : "ثبت نقش جدید"}
        </button>
      </form>
    );
  }

  return (
    <>
      <button className="btn sm" onClick={() => setIsOpen(true)}>
        ویرایش نقش
      </button>
      {!isSystem && (
        <button className="btn sm" style={{ color: "var(--crit)", borderColor: "var(--crit)" }} onClick={handleDelete} disabled={isPending}>
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
                  <div
                    style={{
                      maxHeight: "350px",
                      overflowY: "auto",
                      border: "1px solid var(--line)",
                      borderRadius: "9px",
                      padding: "10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {allPerms.map((perm) => (
                      <label
                        key={perm}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPerms.includes(perm)}
                          onChange={() => handleTogglePerm(perm)}
                          style={{ accentColor: "var(--accent)" }}
                        />
                        <b>{perm}</b> · {permLabels[perm] || perm}
                      </label>
                    ))}
                  </div>
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
    </>
  );
}
