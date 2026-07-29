"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTrain } from "@/app/actions/train";

export default function TrainRowActions({ id, canEdit, canDelete }: { id: number, canEdit: boolean, canDelete: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div style={{ display: "flex", gap: 6 }}>
      {canEdit && (
        <button
          className="btn sm"
          disabled={pending}
          onClick={() => router.push(`/trains/${id}/edit`)}
        >
          ویرایش
        </button>
      )}
      {canDelete && (
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
      )}
    </div>
  );
}
