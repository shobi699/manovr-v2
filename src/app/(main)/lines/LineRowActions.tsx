"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteLine } from "@/app/actions/line";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

export default function LineRowActions({ id, canEdit, canDelete }: { id: number, canEdit: boolean, canDelete: boolean }) {
  const [pending, start] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleDelete = () => {
    start(async () => {
      const res = await deleteLine(id);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("خط با موفقیت حذف شد.");
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
            onClick={() => router.push(`/lines/${id}/edit`)}
          >
            ویرایش
          </button>
        )}
        {canDelete && (
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
        title="حذف خط"
        message="آیا از حذف این خط مطمئن هستید؟"
        confirmText="حذف خط"
        cancelText="انصراف"
        variant="danger"
        isLoading={pending}
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
