"use client";

import { useActionState, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createManovr } from "@/app/actions/manovr";
import { ManovrType } from "@/lib/enums";
import { isPermanentTransfer } from "@/lib/manovr-rules";
import JalaliDateTimePicker from "@/components/JalaliDateTimePicker";
import SearchableSelect from "@/components/SearchableSelect";

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
  const [rahbar1Id, setRahbar1Id] = useState<string>("");
  const [rahbar2Id, setRahbar2Id] = useState<string>("");
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

  const typeOptions = useMemo(() => {
    const list = manovrTypes ? manovrTypes.filter((v) => v.isActive !== false) : [];
    const existingCodes = new Set(list.map((v) => v.code));
    for (const [k, v] of Object.entries(ManovrType)) {
      const code = Number(k);
      if (!existingCodes.has(code)) {
        list.push({ code, label: v, isActive: true });
      }
    }
    return list.sort((a, b) => a.code - b.code).map((v) => ({
      value: String(v.code),
      label: v.label,
    }));
  }, [manovrTypes]);

  const trainOptions = useMemo(() => {
    return trains.map((t) => ({
      value: String(t.id),
      label: `قطار ${t.code} ${t.lineName ? `(فعلی: ${t.lineName})` : ""}`,
    }));
  }, [trains]);

  const sourceLineOptions = useMemo(() => {
    return [
      { value: "", label: "— انتخاب مبدأ —" },
      ...lines.map((l) => ({ value: String(l.id), label: l.name || `خط ${l.id}` })),
    ];
  }, [lines]);

  const destLineOptions = useMemo(() => {
    if (isPermType) {
      return [{ value: "", label: "— خروج دائم از پایانه —" }];
    }
    return [
      { value: "", label: "انتخاب مقصد…" },
      ...lines.map((l) => {
        const isSame = sourceLineId && String(l.id) === sourceLineId;
        return {
          value: String(l.id),
          label: `${l.name || `خط ${l.id}`}${isSame ? " (همین خط)" : ""}`,
        };
      }),
    ];
  }, [lines, sourceLineId, isPermType]);

  const rahbar1Options = useMemo(() => {
    return rahbaran.map((p) => ({
      value: String(p.id),
      label: p.name || `کاربر ${p.id}`,
    }));
  }, [rahbaran]);

  const rahbar2Options = useMemo(() => {
    return [
      { value: "", label: "— بدون راهبر کمکی —" },
      ...rahbaran.map((p) => ({
        value: String(p.id),
        label: p.name || `کاربر ${p.id}`,
      })),
    ];
  }, [rahbaran]);

  return (
    <form action={action}>
      {state?.error && <div className="err" style={{ marginBottom: 12 }}>{state.error}</div>}

      <div className="field">
        <label htmlFor="type">نوع مانور *</label>
        <SearchableSelect
          name="type"
          value={selectedType}
          onChange={(val) => handleTypeChange(String(val))}
          options={typeOptions}
          placeholder="نوع مانور را جستجو و انتخاب کنید..."
          required
        />
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
        <SearchableSelect
          name="trainId"
          value={selectedTrainId}
          onChange={(val) => handleTrainChange(String(val))}
          options={trainOptions}
          placeholder="قطار مورد نظر را جستجو کنید..."
          required
        />
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
          <SearchableSelect
            name="sourceLineId"
            value={sourceLineId}
            onChange={(val) => {
              const vStr = String(val);
              setSourceLineId(vStr);
              if (isStaticMode || isPermType) setDestinationLineId(vStr);
            }}
            options={sourceLineOptions}
            placeholder="جستجوی خط مبدأ..."
          />
        </div>

        <div className="field">
          <label htmlFor="destinationLineId">مقصد {isPermType ? "(خروج دائم)" : "*"}</label>
          <SearchableSelect
            name="destinationLineId"
            value={destinationLineId}
            onChange={(val) => setDestinationLineId(String(val))}
            options={destLineOptions}
            placeholder={isPermType ? "— خروج دائم از پایانه —" : "جستجوی خط مقصد..."}
            required={!isPermType}
          />
        </div>
      </div>

      {selectedTrain && (
        <input type="hidden" name="slotIndex" value={selectedTrain.slotIndex ?? 0} />
      )}

      <div className="grid2">
        <div className="field">
          <label htmlFor="rahbar1Id">راهبر ۱ *</label>
          <SearchableSelect
            name="rahbar1Id"
            value={rahbar1Id}
            onChange={(val) => setRahbar1Id(String(val))}
            options={rahbar1Options}
            placeholder="جستجوی راهبر ۱..."
            required
          />
        </div>
        <div className="field">
          <label htmlFor="rahbar2Id">راهبر ۲ (کمکی)</label>
          <SearchableSelect
            name="rahbar2Id"
            value={rahbar2Id}
            onChange={(val) => setRahbar2Id(String(val))}
            options={rahbar2Options}
            placeholder="جستجوی راهبر کمکی..."
          />
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
