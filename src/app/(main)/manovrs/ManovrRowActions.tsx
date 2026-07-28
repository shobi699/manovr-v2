"use client";

import { useTransition } from "react";
import { finishManovr, confirmManovr, deleteManovr } from "@/app/actions/manovr";

export default function ManovrRowActions({
  id,
  status,
  confirmation,
  canEdit = false,
  canConfirm = false,
  canDelete = false,
}: {
  id: number;
  status: number;
  confirmation: number;
  canEdit?: boolean;
  canConfirm?: boolean;
  canDelete?: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <div style={{ display: "flex", gap: 6 }}>
      {status === 1 && canEdit && (
        <button
          className="btn sm"
          disabled={pending}
          onClick={() => start(async () => { await finishManovr(id); })}
          title="اتمام مانور"
        >
          اتمام
        </button>
      )}
      {confirmation !== 1 && canConfirm && (
        <button
          className="btn sm"
          disabled={pending}
          onClick={() => start(async () => { await confirmManovr(id, 1); })}
          title="تأیید"
        >
          تأیید
        </button>
      )}
      {status !== 3 && canDelete && (
        <button
          className="btn sm"
          disabled={pending}
          onClick={() => {
            if (confirm("این مانور حذف شود؟")) start(async () => { await deleteManovr(id); });
          }}
          title="حذف"
          style={{ color: "var(--crit)" }}
        >
          حذف
        </button>
      )}
    </div>
  );
}
