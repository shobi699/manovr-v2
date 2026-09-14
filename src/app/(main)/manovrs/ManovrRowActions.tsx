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
  isAdmin = false,
}: {
  id: number;
  status: number;
  confirmation: number;
  canEdit?: boolean;
  canConfirm?: boolean;
  canDelete?: boolean;
  isAdmin?: boolean;
}) {
  const [pending, start] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const isCompleted = status === 2;

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
    if (isCompleted && !isAdmin) {
      toast.error("این مانور به پایان رسیده است. حذف مانورهای خاتمه‌یافته منحصراً در اختیارات مدیر سیستم می‌باشد.");
      return;
    }

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
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
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
          isCompleted && !isAdmin ? (
            <button
              type="button"
              disabled
              className="btn sm outline"
              title="این مانور به پایان رسیده است؛ حذف سوابق خاتمه‌یافته منحصراً توسط مدیر سیستم مجاز است."
              style={{ opacity: 0.45, cursor: "not-allowed", fontSize: "11px" }}
            >
              🔒 حذف (فقط مدیر)
            </button>
          ) : (
            <button
              className="btn sm"
              disabled={pending}
              onClick={() => setShowDeleteConfirm(true)}
              title={isCompleted ? "حذف مانور خاتمه‌یافته با اختیارات مدیر" : "حذف"}
              style={{ color: "var(--crit)" }}
            >
              حذف
            </button>
          )
        )}
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title={isCompleted ? "حذف مانور خاتمه‌یافته (توسط مدیر)" : "حذف مانور"}
        message={
          isCompleted
            ? "⚠️ توجه: این مانور به پایان رسیده است. آیا به عنوان مدیر سیستم از حذف آن اطمینان دارید؟"
            : "آیا از حذف این مانور اطمینان دارید؟"
        }
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

