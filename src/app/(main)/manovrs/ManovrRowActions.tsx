"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finishManovr, confirmManovr, deleteManovr } from "@/app/actions/manovr";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleFinish = () => {
    start(async () => {
      const res = await finishManovr(id);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("مانور با موفقیت به اتمام رسید.");
        router.refresh();
      }
    });
  };

  const handleConfirm = () => {
    start(async () => {
      const res = await confirmManovr(id, 1);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("مانور با موفقیت تأیید شد.");
        router.refresh();
      }
    });
  };

  const handleDelete = () => {
    start(async () => {
      const res = await deleteManovr(id);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("مانور با موفقیت حذف شد.");
        setShowDeleteConfirm(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <div style={{ display: "flex", gap: 6 }}>
        {status === 1 && canEdit && (
          <button
            className="btn sm"
            disabled={pending}
            onClick={handleFinish}
            title="اتمام مانور"
          >
            اتمام
          </button>
        )}
        {confirmation !== 1 && canConfirm && (
          <button
            className="btn sm"
            disabled={pending}
            onClick={handleConfirm}
            title="تأیید"
          >
            تأیید
          </button>
        )}
        {status !== 3 && canDelete && (
          <button
            className="btn sm"
            disabled={pending}
            onClick={() => setShowDeleteConfirm(true)}
            title="حذف"
            style={{ color: "var(--crit)" }}
          >
            حذف
          </button>
        )}
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="حذف مانور"
        message="آیا از حذف این مانور اطمینان دارید؟"
        confirmText="حذف مانور"
        cancelText="انصراف"
        variant="danger"
        isLoading={pending}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
