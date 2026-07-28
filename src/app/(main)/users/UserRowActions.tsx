"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteUser } from "@/app/actions/user";

export default function UserRowActions({ id, currentUserId }: { id: number; currentUserId: number }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const router = useRouter();

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <button
        className="btn sm"
        disabled={pending}
        onClick={() => router.push(`/users/${id}/edit`)}
      >
        ویرایش
      </button>
      {id !== currentUserId && (
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
