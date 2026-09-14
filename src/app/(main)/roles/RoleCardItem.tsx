"use client";

import React, { useState } from "react";
import RolesFormClient from "./RolesFormClient";
import type { PermGroup } from "@/lib/perms";

interface RoleCardItemProps {
  role: {
    id: number;
    name: string;
    isSystem: boolean;
    permissions: string;
    _count: { personnel: number };
  };
  allPerms: readonly string[];
  permLabels: Record<string, string>;
  permGroups: Record<string, PermGroup>;
  canEdit: boolean;
  canDelete: boolean;
}

export default function RoleCardItem({
  role,
  allPerms,
  permLabels,
  permGroups,
  canEdit,
  canDelete,
}: RoleCardItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  let permsList: string[] = [];
  try {
    permsList = JSON.parse(role.permissions);
  } catch {
    permsList = [];
  }

  const coveragePercent = allPerms.length > 0
    ? Math.round((permsList.length / allPerms.length) * 100)
    : 0;

  // محاسبه تعداد دسترسی‌های فعال در هر گروه
  const groupStats = Object.entries(permGroups).map(([key, group]) => {
    const groupPerms = group.perms as unknown as string[];
    const activeInGroup = groupPerms.filter((p) => permsList.includes(p));
    return {
      key,
      label: group.label,
      icon: group.icon,
      total: groupPerms.length,
      active: activeInGroup.length,
      activePerms: activeInGroup,
    };
  });

  const activeGroups = groupStats.filter((g) => g.active > 0);

  return (
    <div
      className="card"
      style={{
        border: "1px solid var(--line)",
        borderRadius: "10px",
        overflow: "hidden",
        transition: "box-shadow 0.2s ease",
      }}
    >
      <div
        className="card-head"
        style={{
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "var(--panel-2, rgba(0,0,0,0.02))",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "20px" }}>🛡️</span>
          <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
            {role.name}
          </h2>
          {role.isSystem ? (
            <span
              className="pill p-rail"
              style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px" }}
            >
              سیستمی
            </span>
          ) : (
            <span
              className="pill p-mut"
              style={{ fontSize: "11px", padding: "2px 8px" }}
            >
              سفارشی
            </span>
          )}
        </div>

        <span className="spacer" />

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              fontSize: "12px",
              color: "var(--ink-soft)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            👥 تعداد کاربران: <strong style={{ color: "var(--ink)" }}>{role._count.personnel}</strong> نفر
          </span>
          <RolesFormClient
            mode="edit"
            roleId={role.id}
            roleName={role.name}
            activePerms={permsList}
            allPerms={allPerms}
            permLabels={permLabels}
            permGroups={permGroups}
            isSystem={role.isSystem}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </div>
      </div>

      <div className="card-body" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
        {/* شاخص درصد پوشش اختیارات */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)" }}>
              سطح دسترسی سیستم:
            </span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: coveragePercent > 80 ? "#3b82f6" : coveragePercent > 40 ? "#10b981" : "var(--ink-soft)" }}>
              {coveragePercent}٪ اختیارات ({permsList.length} از {allPerms.length} مجوز)
            </span>
          </div>
          <div
            style={{
              width: "100%",
              height: "6px",
              borderRadius: "4px",
              background: "rgba(0,0,0,0.06)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${coveragePercent}%`,
                height: "100%",
                background: coveragePercent === 100
                  ? "linear-gradient(90deg, #3b82f6, #6366f1)"
                  : coveragePercent > 50
                  ? "linear-gradient(90deg, #10b981, #3b82f6)"
                  : "linear-gradient(90deg, #f59e0b, #10b981)",
                borderRadius: "4px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* خلاصه دسته‌های فعال با آیکون و شمارنده */}
        <div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: "8px" }}>
            بخش‌های مجاز این نقش:
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {activeGroups.length === 0 ? (
              <span className="muted" style={{ fontSize: "12px" }}>هیچ بخشی مجاز نشده است (نقش غیرفعال).</span>
            ) : (
              activeGroups.map((g) => (
                <span
                  key={g.key}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: g.active === g.total ? "rgba(59, 130, 246, 0.08)" : "rgba(0, 0, 0, 0.04)",
                    border: g.active === g.total ? "1px solid rgba(59, 130, 246, 0.25)" : "1px solid var(--line)",
                    color: g.active === g.total ? "var(--accent, #3b82f6)" : "var(--ink)",
                  }}
                >
                  <span>{g.icon}</span>
                  <span>{g.label}</span>
                  <span
                    style={{
                      fontSize: "10px",
                      opacity: 0.8,
                      direction: "ltr",
                      display: "inline-block",
                    }}
                  >
                    ({g.active}/{g.total})
                  </span>
                </span>
              ))
            )}
          </div>
        </div>

        {/* دکمه باز و بسته کردن ریز مجوزها */}
        <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: "10px" }}>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--accent, #3b82f6)",
              padding: "4px 0",
            }}
          >
            <span>{isExpanded ? "▲ بستن ریز مجوزها" : "▼ مشاهده و بررسی جزئیات ریز مجوزها"}</span>
            <span className="muted" style={{ fontSize: "11px" }}>
              ({permsList.length} مجوز فعال)
            </span>
          </button>

          {isExpanded && (
            <div
              style={{
                marginTop: "10px",
                padding: "12px",
                background: "var(--panel-2, rgba(0,0,0,0.02))",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {activeGroups.map((g) => (
                <div key={g.key}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    <span>{g.icon}</span>
                    <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{g.label}</strong>
                    <span className="muted" style={{ fontSize: "11px" }}>
                      ({g.active} از {g.total})
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {g.activePerms.map((p) => (
                      <span
                        key={p}
                        className="pill p-mut"
                        style={{
                          fontSize: "11px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span>{permLabels[p] || p}</span>
                        <span className="muted" style={{ fontSize: "9px", fontFamily: "monospace" }}>
                          ({p})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
