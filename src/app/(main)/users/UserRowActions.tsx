"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteUser } from "@/app/actions/user";

export default function UserRowActions({ id, currentUserId, canEdit, canDelete }: { id: number; currentUserId: number, canEdit: boolean, canDelete: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const router = useRouter();

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {canEdit && (
        <button
          className="btn sm"
          disabled={pending}
          onClick={() => router.push(`/users/${id}/edit`)}
        >
          ویرایش
        </button>
      )}
      {canDelete && id !== currentUserId && (
        <button
          className="btn sm"
          disabled={pending}
          onClick={() => {
            if (!confirm("این کاربر حذف شود؟")) return;
            start(async () => {
              const res = await deleteUser(id);
              if (res?.error) setErr(res.error);
            });
          }}
          style={{ color: "var(--crit)" }}
        >
          حذف
        </button>
      )}
      {err && <span style={{ color: "var(--crit)", fontSize: 12 }}>{err}</span>}
    </div>
  );
}
