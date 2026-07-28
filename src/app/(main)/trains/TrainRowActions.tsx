"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTrain } from "@/app/actions/train";

export default function TrainRowActions({ id }: { id: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button
        className="btn sm"
        disabled={pending}
        onClick={() => router.push(`/trains/${id}/edit`)}
      >
        ویرایش
      </button>
      <button
        className="btn sm"
        disabled={pending}
        onClick={() => {
          if (confirm("این قطار حذف/غیرفعال شود؟"))
            start(async () => { await deleteTrain(id); });
        }}
        style={{ color: "var(--crit)" }}
      >
        حذف
      </button>
    </div>
  );
}
