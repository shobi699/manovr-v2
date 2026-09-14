"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { updateTrain } from "@/app/actions/train";
import { TrainType, TrainTypeFull } from "@/lib/enums";

type LineOpt = { id: number; name: string };
type Train = {
  id: number;
  code: string;
  type: number;
  lineId: number | null;
  isDisposed: boolean;
  hasKafshak?: boolean;
  noAtp?: boolean;
  movadDavvar?: string | null;
  noLicense?: boolean;
};

export default function EditTrainForm({
  train,
  lines,
  trainTypes = [],
  canEditKafshak,
  canEditAtp,
  canEditRotary,
  canEditLicense,
}: {
  train: Train;
  lines: LineOpt[];
  trainTypes?: { code: number; label: string; isActive?: boolean }[];
  canEditKafshak: boolean;
  canEditAtp: boolean;
  canEditRotary: boolean;
  canEditLicense: boolean;
}) {
  const [state, action, pending] = useActionState(updateTrain, null);
  const router = useRouter();

  return (
    <form action={action}>
      <input type="hidden" name="id" value={train.id} />
      {state?.error && <div className="err">{state.error}</div>}

      <div className="grid2">
        <div className="field">
          <label htmlFor="code">کد قطار *</label>
          <input id="code" name="code" className="input" defaultValue={train.code} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="type">نوع *</label>
          <select id="type" name="type" className="input" defaultValue={train.type}>
            {trainTypes && trainTypes.length > 0
              ? trainTypes
                  .filter((t) => t.isActive !== false)
                  .map((t) => (
                    <option key={t.code} value={t.code}>{t.label}</option>
                  ))
              : Object.entries(TrainTypeFull).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))
            }
          </select>
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="lineId">خط فعلی</label>
          <select id="lineId" name="lineId" className="input" defaultValue={train.lineId ?? ""}>
            <option value="">بدون خط</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="isDisposed">وضعیت در سیستم</label>
          <select id="isDisposed" name="isDisposed" className="input" defaultValue={train.isDisposed ? "1" : "0"}>
            <option value="0">فعال</option>
            <option value="1">غیرفعال</option>
          </select>
        </div>
      </div>

      <h3 style={{ borderBottom: "1px solid var(--line)", paddingBottom: "6px", fontWeight: "700", margin: "16px 0 12px", fontSize: "13px" }}>
        ویژگی‌ها و وضعیت فنی قطار
      </h3>

      <div className="grid2" style={{ marginBottom: "12px" }}>
        <div className="field">
          <label htmlFor="movadDavvar">موعد دوّار (Wheel Turning)</label>
          <select id="movadDavvar" name="movadDavvar" className="input" defaultValue={train.movadDavvar || ""} disabled={!canEditRotary}>
            <option value="">-- بدون موعد دوّار --</option>
            <option value="A">🔄 موعد دوّار - سطح A</option>
            <option value="B">🔄 موعد دوّار - سطح B</option>
            <option value="C">🔄 موعد دوّار - سطح C</option>
          </select>
        </div>

        <div className="field" style={{ display: "flex", flexDirection: "column", gap: "8px", justifyContent: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: canEditKafshak ? "pointer" : "not-allowed", opacity: canEditKafshak ? 1 : 0.5 }}>
            <input type="checkbox" name="hasKafshak" value="1" defaultChecked={!!train.hasKafshak} disabled={!canEditKafshak} />
            <span>⚡ <b>وجود کفشک (Third Rail Collector Shoe)</b></span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: canEditAtp ? "pointer" : "not-allowed", opacity: canEditAtp ? 1 : 0.5 }}>
            <input type="checkbox" name="noAtp" value="1" defaultChecked={!!train.noAtp} disabled={!canEditAtp} />
            <span>🚨 <b style={{ color: "var(--crit)" }}>عدم ATP (سیستم حفاظت قطار)</b></span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: canEditLicense ? "pointer" : "not-allowed", opacity: canEditLicense ? 1 : 0.5 }}>
            <input type="checkbox" name="noLicense" value="1" defaultChecked={!!train.noLicense} disabled={!canEditLicense} />
            <span>🛑 <b style={{ color: "var(--crit)" }}>بدون مجوز حرکت</b></span>
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button className="btn accent" disabled={pending}>
          {pending ? "در حال ذخیره…" : "ذخیره تغییرات"}
        </button>
        <button type="button" className="btn" onClick={() => router.push("/trains")}>
          انصراف
        </button>
      </div>
    </form>
  );
}
