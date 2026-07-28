"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteLine } from "@/app/actions/line";

export default function LineRowActions({ id }: { id: number }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const router = useRouter();

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <button
        className="btn sm"
        disabled={pending}
        onClick={() => router.push(`/lines/${id}/edit`)}
      >
        ویرایش
      </button>
      <button
        className="btn sm"
        disabled={pending}
        onClick={() => {
          if (!confirm("این خط حذف شود؟")) return;
          start(async () => {
            const res = await deleteLine(id);
            if (res?.error) setErr(res.error);
          });
        }}
        style={{ color: "var(--crit)" }}
      >
        حذف
      </button>
      {err && <span style={{ color: "var(--crit)", fontSize: 12 }}>{err}</span>}
    </div>
  );
}
