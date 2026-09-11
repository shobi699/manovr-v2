"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTrain } from "@/app/actions/train";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

export default function TrainRowActions({ id, canEdit, canDelete }: { id: number, canEdit: boolean, canDelete: boolean }) {
  const [pending, start] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleDelete = () => {
    start(async () => {
      try {
        const res = await deleteTrain(id);
        if (res && "error" in res && res.error) {
          toast.error(res.error);
          return;
        }
        toast.success("قطار با موفقیت حذف یا غیرفعال شد.");
        setShowConfirm(false);
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message || "خطا در حذف قطار");
      }
    });
  };

  return (
    <>
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
            onClick={() => setShowConfirm(true)}
            style={{ color: "var(--crit)" }}
          >
            حذف
          </button>
        )}
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        title="حذف قطار"
        message="آیا از حذف یا غیرفعال‌سازی این قطار مطمئن هستید؟"
        confirmText="حذف قطار"
        cancelText="انصراف"
        variant="danger"
        isLoading={pending}
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
