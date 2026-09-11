"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteUser } from "@/app/actions/user";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

export default function UserRowActions({ id, currentUserId, canEdit, canDelete }: { id: number; currentUserId: number, canEdit: boolean, canDelete: boolean }) {
  const [pending, start] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleDelete = () => {
    start(async () => {
      const res = await deleteUser(id);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("کاربر با موفقیت حذف شد.");
        setShowConfirm(false);
        router.refresh();
      }
    });
  };

  return (
    <>
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
            onClick={() => setShowConfirm(true)}
            style={{ color: "var(--crit)" }}
          >
            حذف
          </button>
        )}
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        title="حذف کاربر"
        message="آیا از حذف این کاربر اطمینان دارید؟"
        confirmText="حذف کاربر"
        cancelText="انصراف"
        variant="danger"
        isLoading={pending}
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
