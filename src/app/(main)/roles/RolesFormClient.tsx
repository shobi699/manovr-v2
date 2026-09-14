"use client";

import React, { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRole, updateRole, deleteRole } from "@/app/actions/role";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import type { PermGroup } from "@/lib/perms";

interface RolesFormClientProps {
  mode: "create" | "edit";
  roleId?: number;
  roleName?: string;
  activePerms?: string[];
  allPerms: readonly string[];
  permLabels: Record<string, string>;
  permGroups?: Record<string, PermGroup>;
  isSystem?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export default function RolesFormClient({
  mode,
  roleId,
  roleName = "",
  activePerms = [],
  allPerms = [],
  permLabels = {},
  permGroups = {},
  isSystem = false,
  canEdit = true,
  canDelete = true,
}: RolesFormClientProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(roleName);
  const [selectedPerms, setSelectedPerms] = useState<string[]>(activePerms);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();

  const handleTogglePerm = (perm: string) => {
    setSelectedPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSelectAllGlobal = () => {
    setSelectedPerms([...allPerms]);
  };

  const handleClearAllGlobal = () => {
    setSelectedPerms([]);
  };

  // گروه‌بندی ساختاریافته بر اساس permGroups ارسالی
  const resolvedGroups = useMemo(() => {
    if (permGroups && Object.keys(permGroups).length > 0) {
      return permGroups;
    }
    const fallback: Record<string, PermGroup> = {};
    allPerms.forEach((perm) => {
      const key = perm.split(".")[0];
      if (!fallback[key]) {
        fallback[key] = {
          label: key,
          icon: "⚙️",
          description: "",
          perms: [],
        };
      }
      fallback[key].perms.push(perm as any);
    });
    return fallback;
  }, [allPerms, permGroups]);

  // فیلتر کردن مجوزها بر اساس جستجوی کاربر
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return resolvedGroups;

    const result: Record<string, PermGroup> = {};
    Object.entries(resolvedGroups).forEach(([gKey, group]) => {
      const matchedPerms = group.perms.filter((p) => {
        const label = permLabels[p] || "";
        return label.toLowerCase().includes(q) || p.toLowerCase().includes(q);
      });
      if (matchedPerms.length > 0) {
        result[gKey] = {
          ...group,
          perms: matchedPerms,
        };
      }
    });
    return result;
  }, [resolvedGroups, searchQuery, permLabels]);

  const toggleGroup = (perms: string[]) => {
    const allSelected = perms.every((p) => selectedPerms.includes(p));
    if (allSelected) {
      setSelectedPerms((prev) => prev.filter((p) => !perms.includes(p)));
    } else {
      setSelectedPerms((prev) => Array.from(new Set([...prev, ...perms])));
    }
  };

  const renderPermsList = (maxHeight = "400px") => (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* نوار جستجو و کلیدهای سراسری */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
          padding: "8px 10px",
          background: "var(--panel-2, rgba(0,0,0,0.03))",
          borderRadius: "8px",
          border: "1px solid var(--line)",
        }}
      >
        <div style={{ flex: 1, minWidth: "180px", position: "relative" }}>
          <input
            type="text"
            placeholder="🔍 جستجوی دسترسی یا کد انگلیسی..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 10px",
              fontSize: "12px",
              borderRadius: "6px",
              border: "1px solid var(--line)",
              background: "var(--panel)",
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                left: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "11px",
                color: "var(--ink-soft)",
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <button
            type="button"
            className="btn sm"
            onClick={handleSelectAllGlobal}
            style={{ fontSize: "11px", padding: "4px 8px" }}
            title="انتخاب تمامی اختیارات"
          >
            انتخاب همه ({allPerms.length})
          </button>
          <button
            type="button"
            className="btn sm"
            onClick={handleClearAllGlobal}
            style={{ fontSize: "11px", padding: "4px 8px" }}
            title="لغو انتخاب تمام اختیارات"
          >
            لغو همه
          </button>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: "12px",
              background: selectedPerms.length > 0 ? "rgba(59, 130, 246, 0.12)" : "rgba(0,0,0,0.05)",
              color: selectedPerms.length > 0 ? "var(--accent, #3b82f6)" : "var(--ink-soft)",
            }}
          >
            {selectedPerms.length} از {allPerms.length}
          </span>
        </div>
      </div>

      {/* محتوای گروه‌ها */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          maxHeight,
          overflowY: "auto",
          padding: "8px",
          border: "1px solid var(--line)",
          borderRadius: "8px",
          background: "var(--panel)",
        }}
      >
        {Object.keys(filteredGroups).length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--ink-soft)", fontSize: "13px" }}>
            مجوزی منطبق با جستجوی شما یافت نشد.
          </div>
        ) : (
          Object.entries(filteredGroups).map(([gKey, group]) => {
            const groupPerms = group.perms as unknown as string[];
            const selectedInGroup = groupPerms.filter((p) => selectedPerms.includes(p));
            const allSelected = groupPerms.length > 0 && selectedInGroup.length === groupPerms.length;

            return (
              <div
                key={gKey}
                style={{
                  flexShrink: 0,
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  overflow: "hidden",
                  background: "var(--panel)",
                }}
              >
                {/* سربرگ گروه */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "var(--panel-2, rgba(0,0,0,0.02))",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>{group.icon || "📁"}</span>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--ink)" }}>
                        {group.label}
                      </span>
                      {group.description && (
                        <span
                          className="muted"
                          style={{ fontSize: "11px", display: "block", marginTop: "1px" }}
                        >
                          {group.description}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 6px",
                        borderRadius: "10px",
                        background: selectedInGroup.length > 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(0,0,0,0.04)",
                        color: selectedInGroup.length > 0 ? "#10b981" : "var(--ink-soft)",
                        fontWeight: 600,
                      }}
                    >
                      {selectedInGroup.length} / {groupPerms.length}
                    </span>
                    <button
                      type="button"
                      className="btn sm"
                      style={{ padding: "2px 8px", fontSize: "11px" }}
                      onClick={() => toggleGroup(groupPerms)}
                    >
                      {allSelected ? "لغو گروه" : "انتخاب گروه"}
                    </button>
                  </div>
                </div>

                {/* لیست چک‌باکس‌های گروه */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                    gap: "8px",
                    padding: "10px 12px",
                  }}
                >
                  {groupPerms.map((p) => {
                    const isChecked = selectedPerms.includes(p);
                    return (
                      <label
                        key={p}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "8px",
                          cursor: "pointer",
                          padding: "6px 8px",
                          borderRadius: "6px",
                          background: isChecked ? "rgba(59, 130, 246, 0.05)" : "transparent",
                          border: isChecked ? "1px solid rgba(59, 130, 246, 0.2)" : "1px solid transparent",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePerm(p)}
                          style={{ marginTop: "3px", cursor: "pointer" }}
                        />
                        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: isChecked ? 600 : 400,
                              color: isChecked ? "var(--ink)" : "var(--ink-soft)",
                              lineHeight: 1.4,
                            }}
                          >
                            {permLabels[p] || p}
                          </span>
                          <span
                            className="muted"
                            style={{
                              fontSize: "10px",
                              fontFamily: "monospace",
                              direction: "ltr",
                              textAlign: "left",
                              marginTop: "2px",
                            }}
                          >
                            {p}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
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
        router.refresh();
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
        router.refresh();
      }
    });
  };

  if (mode === "create") {
    return (
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {error && <div className="err">{error}</div>}
        <div className="field">
          <label style={{ fontWeight: 600, fontSize: "13px" }}>نام نقش (مثلاً: مسئول شیفت پایانه)</label>
          <input
            type="text"
            className="input"
            required
            placeholder="عنوان نقش سازمانی..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label style={{ marginBottom: "8px", fontWeight: 600, fontSize: "13px" }}>
            تعیین اختیارات و دسترسی‌های نقش
          </label>
          {renderPermsList("360px")}
        </div>

        <button type="submit" className="btn primary" style={{ width: "100%", padding: "10px" }} disabled={isPending}>
          {isPending ? "در حال ثبت نقش..." : "ثبت نقش جدید"}
        </button>
      </form>
    );
  }

  return (
    <>
      {canEdit && (
        <button className="btn sm primary" onClick={() => setIsOpen(true)}>
          ویرایش اختیارات
        </button>
      )}
      {canDelete && !isSystem && (
        <button
          className="btn sm"
          style={{ color: "var(--crit)", borderColor: "var(--crit)" }}
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isPending}
        >
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
            backgroundColor: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(5px)",
            zIndex: 999,
            display: "grid",
            placeItems: "center",
            padding: "16px",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "750px",
              backgroundColor: "var(--panel)",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
              borderRadius: "12px",
            }}
          >
            <div
              className="card-head"
              style={{
                borderBottom: "1px solid var(--line)",
                padding: "14px 18px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "20px" }}>🛡️</span>
                <h2 style={{ fontSize: "16px", margin: 0 }}>ویرایش نقش و اختیارات: {roleName}</h2>
                {isSystem && (
                  <span className="pill p-rail" style={{ fontSize: "11px" }}>
                    سیستمی
                  </span>
                )}
              </div>
              <span className="spacer" />
              <button
                className="btn sm"
                onClick={() => setIsOpen(false)}
                style={{ padding: "4px 10px", fontSize: "12px" }}
              >
                بستن
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ overflowY: "auto", flex: 1 }}>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "18px" }}>
                {error && <div className="err">{error}</div>}
                <div className="field">
                  <label style={{ fontWeight: 600, fontSize: "13px" }}>
                    نام نقش{" "}
                    {isSystem && (
                      <span className="muted" style={{ fontSize: "11px", fontWeight: "normal" }}>
                        (عناوین نقش‌های سیستمی جهت حفظ پایداری سیستم قفل شده است)
                      </span>
                    )}
                  </label>
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
                  <label style={{ marginBottom: "8px", fontWeight: 600, fontSize: "13px" }}>
                    مجوزها و سطوح دسترسی
                  </label>
                  {renderPermsList("420px")}
                </div>

                <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                  <button type="submit" className="btn primary" style={{ flex: 1, padding: "10px" }} disabled={isPending}>
                    {isPending ? "در حال به‌روزرسانی..." : "ذخیره تغییرات نقش"}
                  </button>
                  <button type="button" className="btn" style={{ flex: 1, padding: "10px" }} onClick={() => setIsOpen(false)}>
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
        title="حذف نقش کاربری"
        message={`آیا از حذف نقش «${roleName}» اطمینان دارید؟ کاربران منتسب به این نقش نیازمند تخصیص مجدد خواهند بود.`}
        confirmText="حذف قطعی نقش"
        cancelText="انصراف"
        variant="danger"
        isLoading={isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
