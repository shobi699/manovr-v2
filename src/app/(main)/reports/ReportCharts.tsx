"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";

type D = { label: string; value: number };

const COLORS = ["#1f3a5f", "#d8842a", "#2e7d5b", "#b23b3b", "#7ea6d8", "#b8860b"];

export default function ReportCharts({
  typeData,
  statusData,
  rahbarData,
  total,
}: {
  typeData: D[];
  statusData: D[];
  rahbarData: D[];
  total: number;
}) {
  const [view, setView] = useState<"type" | "rahbar">("type");
  const active = view === "type" ? typeData : rahbarData;

  const exportCsv = () => {
    const rows = [["عنوان", "تعداد"], ...active.map((d) => [d.label, String(d.value)])];
    const csv = "﻿" + rows.map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${view}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="tiles">
        <div className="tile"><div className="n rail">{total}</div><div className="l">کل مانورها</div></div>
        {statusData.map((s) => (
          <div className="tile" key={s.label}>
            <div className="n">{s.value}</div>
            <div className="l">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <h2>گزارش قابل‌شخصی‌سازی</h2>
          <span className="spacer" />
          <div style={{ display: "flex", gap: 8 }}>
            <button className={`btn sm${view === "type" ? " primary" : ""}`} onClick={() => setView("type")}>بر اساس نوع</button>
            <button className={`btn sm${view === "rahbar" ? " primary" : ""}`} onClick={() => setView("rahbar")}>عملکرد راهبران</button>
            <button className="btn sm accent" onClick={exportCsv}>خروجی اکسل</button>
          </div>
        </div>
        <div className="card-body">
          <div style={{ width: "100%", height: 320, direction: "ltr" }}>
            <ResponsiveContainer>
              <BarChart data={active} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--ink-soft)" }} />
                <Tooltip
                  contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "var(--ink)" }}
                />
                <Bar dataKey="value" fill="var(--accent)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>توزیع وضعیت مانورها</h2></div>
        <div className="card-body">
          <div style={{ width: "100%", height: 280, direction: "ltr" }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={100} label>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}
