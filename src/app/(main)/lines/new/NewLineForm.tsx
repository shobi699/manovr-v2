"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createLine } from "@/app/actions/line";
import { Terminal } from "@/lib/enums";

interface NewLineFormProps {
  terminals: { code: number; label: string }[];
}

export default function NewLineForm({ terminals }: NewLineFormProps) {
  const [state, action, pending] = useActionState(createLine, null);
  const router = useRouter();

  return (
    <form action={action}>
      {state?.error && <div className="err">{state.error}</div>}

      <div className="grid2">
        <div className="field">
          <label htmlFor="name">نام خط *</label>
          <input id="name" name="name" className="input" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="tag">Tag</label>
          <input id="tag" name="tag" className="input" />
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="terminal">ترمینال *</label>
          <select id="terminal" name="terminal" className="input" defaultValue="">
            <option value="" disabled>انتخاب کنید…</option>
            {terminals.map((t) => (
              <option key={t.code} value={t.code}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="capacity">ظرفیت *</label>
          <input id="capacity" name="capacity" type="number" className="input" defaultValue={1} min={1} />
        </div>
      </div>

      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" name="isDynamic" value="1" />
          خط دینامیک
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button className="btn accent" disabled={pending}>
          {pending ? "در حال ثبت…" : "ثبت خط"}
        </button>
        <button type="button" className="btn" onClick={() => router.push("/lines")}>
          انصراف
        </button>
      </div>
    </form>
  );
}
