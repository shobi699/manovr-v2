"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { createManovr } from "@/app/actions/manovr";
import { ManovrType } from "@/lib/enums";
import { isPermanentTransfer } from "@/lib/manovr-rules";
import JalaliDateTimePicker from "@/components/JalaliDateTimePicker";

type LineOpt = { id: number; name?: string };
type TrainOpt = {
  id: number;
  code?: string;
  lineId?: number | null;
  lineName?: string;
  slotIndex?: number;
};
type RahbarOpt = { id: number; name?: string };

export default function NewManovrForm({
  lines,
  trains,
  rahbaran,
  manovrTypes,
}: {
  lines: LineOpt[];
  trains: TrainOpt[];
  rahbaran: RahbarOpt[];
  manovrTypes?: { code: number; label: string; isActive: boolean }[];
}) {
  const [state, action, pending] = useActionState(createManovr, null);
  const router = useRouter();

  const [selectedTrainId, setSelectedTrainId] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [sourceLineId, setSourceLineId] = useState<string>("");
  const [destinationLineId, setDestinationLineId] = useState<string>("");
  const [isStaticMode, setIsStaticMode] = useState<boolean>(false);

  const isPermType = isPermanentTransfer(Number(selectedType));

  // بررسی اینکه آیا نوع مانور انتخابی استاتیک یا تعویض کفشک است
  const isStaticType = (typeVal: string) => {
    const code = Number(typeVal);
    if (code === 4 || code === 20) return true; // 4: استاتیک، 20: تعویض کفشک
    const label = manovrTypes?.find((t) => t.code === code)?.label || ManovrType[code] || "";
    return label.includes("استاتیک") || label.includes("کفشک");
  };

  const handleTrainChange = (trainIdStr: string) => {
    setSelectedTrainId(trainIdStr);
    const train = trains.find((t) => t.id === Number(trainIdStr));
    if (train && train.lineId) {
      const srcId = String(train.lineId);
      setSourceLineId(srcId);
      if (isStaticMode || isStaticType(selectedType) || isPermType) {
        setDestinationLineId(srcId);
      }
    }
  };

  const handleTypeChange = (typeStr: string) => {
    setSelectedType(typeStr);
    const isStatic = isStaticType(typeStr);
    if (isStatic) {
      setIsStaticMode(true);
      if (sourceLineId) {
        setDestinationLineId(sourceLineId);
      }
    } else if (isPermanentTransfer(Number(typeStr))) {
      setIsStaticMode(false);
      if (sourceLineId) {
        setDestinationLineId(sourceLineId);
      }
    }
  };

  const handleStaticToggle = (checked: boolean) => {
    setIsStaticMode(checked);
    if (checked && sourceLineId) {
      setDestinationLineId(sourceLineId);
    }
  };

  const selectedTrain = trains.find((t) => t.id === Number(selectedTrainId));

  return (
    <form action={action}>
      {state?.error && <div className="err" style={{ marginBottom: 12 }}>{state.error}</div>}

      <div className="field">
        <label htmlFor="type">نوع مانور *</label>
        <select
          id="type"
          name="type"
          className="input"
          value={selectedType}
          onChange={(e) => handleTypeChange(e.target.value)}
          required
        >
          <option value="" disabled>انتخاب کنید…</option>
          {(() => {
            const list = manovrTypes ? manovrTypes.filter((v) => v.isActive !== false) : [];
            const existingCodes = new Set(list.map((v) => v.code));
            for (const [k, v] of Object.entries(ManovrType)) {
              const code = Number(k);
              if (!existingCodes.has(code)) {
                list.push({ code, label: v, isActive: true });
              }
            }
            return list.sort((a, b) => a.code - b.code).map((v) => (
              <option key={v.code} value={v.code}>{v.label}</option>
            ));
          })()}
        </select>
      </div>

      {isPermType && (
        <div
          style={{
            margin: "12px 0",
            padding: "12px 14px",
            borderRadius: "8px",
            backgroundColor: "rgba(225, 29, 72, 0.08)",
            border: "1px solid rgba(225, 29, 72, 0.3)",
            color: "#e11d48",
            fontSize: "12.5px",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ display: "block", marginBottom: "4px" }}>🛑 مانور انتقال دائم (خروج از پایانه):</strong>
          قطار انتخاب‌شده پس از ثبت این مانور، از تمامی نقشه‌های ۲بعدی و ۳بعدی پایانه خارج شده و وضعیت آن به خروج دائم/غیرفعال تغییر می‌یابد. گزارش این انتقال در سوابق مانورها محفوظ خواهد ماند.
        </div>
      )}

      <div className="field">
        <label htmlFor="trainId">قطار *</label>
        <select
          id="trainId"
          name="trainId"
          className="input"
          value={selectedTrainId}
          onChange={(e) => handleTrainChange(e.target.value)}
          required
        >
          <option value="" disabled>انتخاب کنید…</option>
          {trains.map((t) => (
            <option key={t.id} value={t.id}>
              قطار {t.code} {t.lineName ? `(فعلی: ${t.lineName})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* چک‌باکس و توضیحات مانور در محل (ثابت) */}
      {!isPermType && (
        <div
          style={{
            margin: "12px 0",
            padding: "12px 14px",
            borderRadius: "8px",
            backgroundColor: isStaticMode ? "rgba(59, 130, 246, 0.09)" : "var(--bg-subtle, #f8fafc)",
            border: isStaticMode ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid var(--border-color, #e2e8f0)",
            transition: "all 0.2s ease",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={isStaticMode}
              onChange={(e) => handleStaticToggle(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#3b82f6" }}
            />
            <span>⚡ مانور در محل (ثبت روی همان خط بدون جابه‌جایی قطار)</span>
          </label>
          {isStaticMode && (
            <div style={{ fontSize: "12.5px", color: "var(--color-primary, #2563eb)", marginTop: "6px", lineHeight: 1.5 }}>
              عملیات (مانند تست استاتیک، تعویض کفشک و...) روی همان خط فعلی ثبت می‌شود و نیازی به انتقال قطار به خط مقصد دیگر نیست.
            </div>
          )}
        </div>
      )}

      <div className="grid2">
        <div className="field">
          <label htmlFor="sourceLineId">مبدأ</label>
          <select
            id="sourceLineId"
            name="sourceLineId"
            className="input"
            value={sourceLineId}
            onChange={(e) => {
              const val = e.target.value;
              setSourceLineId(val);
              if (isStaticMode || isPermType) setDestinationLineId(val);
            }}
          >
            <option value="">— انتخاب مبدأ —</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="destinationLineId">مقصد {isPermType ? "(خروج دائم)" : "*"}</label>
          <select
            id="destinationLineId"
            name="destinationLineId"
            className="input"
            value={destinationLineId}
            onChange={(e) => setDestinationLineId(e.target.value)}
            required={!isPermType}
          >
            <option value="" disabled={!isPermType}>{isPermType ? "— خروج دائم از پایانه —" : "انتخاب مقصد…"}</option>
            {lines.map((l) => {
              const isSame = sourceLineId && String(l.id) === sourceLineId;
              return (
                <option key={l.id} value={l.id}>
                  {l.name} {isSame ? " (همین خط)" : ""}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {selectedTrain && (
        <input type="hidden" name="slotIndex" value={selectedTrain.slotIndex ?? 0} />
      )}

      <div className="grid2">
        <div className="field">
          <label htmlFor="rahbar1Id">راهبر ۱ *</label>
          <select id="rahbar1Id" name="rahbar1Id" className="input" defaultValue="" required>
            <option value="" disabled>انتخاب کنید…</option>
            {rahbaran.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rahbar2Id">راهبر ۲ (کمکی)</label>
          <select id="rahbar2Id" name="rahbar2Id" className="input" defaultValue="">
            <option value="">—</option>
            {rahbaran.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="executionTime">زمان اجرای مانور *</label>
        <JalaliDateTimePicker
          name="executionTime"
          defaultValue={new Date().toISOString()}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="description">توضیحات</label>
        <textarea id="description" name="description" className="input" rows={2} />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button className="btn accent" disabled={pending}>
          {pending ? "در حال ثبت…" : "ثبت مانور"}
        </button>
        <button type="button" className="btn" onClick={() => router.push("/manovrs")}>
          انصراف
        </button>
      </div>
    </form>
  );
}
