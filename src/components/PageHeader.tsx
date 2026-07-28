import Link from "next/link";
import React from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export default function PageHeader({
  title,
  breadcrumb,
  actions,
}: {
  title: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="topbar">
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {breadcrumb && breadcrumb.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--ink-soft)" }}>
            {breadcrumb.map((item, idx) => (
              <React.Fragment key={idx}>
                {item.href ? (
                  <Link href={item.href} style={{ transition: "var(--transition-fluid)" }} className="hover:text-[var(--accent)]">
                    {item.label}
                  </Link>
                ) : (
                  <span>{item.label}</span>
                )}
                {idx < breadcrumb.length - 1 && (
                  <span style={{ fontSize: "9px", opacity: 0.5 }}>/</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
        <h1>{title}</h1>
      </div>
      {actions && (
        <div className="spacer" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {actions}
        </div>
      )}
    </div>
  );
}
