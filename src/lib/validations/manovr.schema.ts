import { z } from "zod";
import {
  optionalString,
  requiredNumber,
  numberWithDefault,
  optionalNumber,
  booleanWithDefault,
} from "./common";

/**
 * شِمای ایجاد مانور جدید
 */
export const createManovrSchema = z.object({
  type: requiredNumber("نوع مانور", 1),
  trainId: requiredNumber("قطار", 1),
  rahbar1Id: requiredNumber("راهبر ۱", 1),
  rahbar2Id: optionalNumber,
  sourceLineId: optionalNumber,
  destinationLineId: optionalNumber,
  slotIndex: numberWithDefault(0),
  description: optionalString,
  executionTime: z
    .preprocess((val) => {
      if (!val) return new Date();
      const d = new Date(val as string | number | Date);
      return isNaN(d.getTime()) ? new Date() : d;
    }, z.date())
    .default(() => new Date()),
  noRedirect: booleanWithDefault(false),
});

export type CreateManovrInput = z.infer<typeof createManovrSchema>;

/**
 * شِمای تایید یا رد مانور
 */
export const confirmManovrSchema = z.object({
  id: requiredNumber("شناسه مانور", 1),
  status: requiredNumber("وضعیت تایید", 1, 2),
  rejectReason: optionalString,
});

export type ConfirmManovrInput = z.infer<typeof confirmManovrSchema>;

/**
 * شِمای پایان مانور
 */
export const finishManovrSchema = z.object({
  id: requiredNumber("شناسه مانور", 1),
});

export type FinishManovrInput = z.infer<typeof finishManovrSchema>;

/**
 * شِمای تایید یا رد دسته‌جمعی (گروهی) مانورها
 */
export const bulkConfirmManovrSchema = z.object({
  ids: z
    .array(z.number().int().positive("شناسه مانور باید عدد مثبت باشد"))
    .min(1, "حداقل یک مانور باید انتخاب شود"),
  status: requiredNumber("وضعیت تایید", 1, 2),
});

export type BulkConfirmManovrInput = z.infer<typeof bulkConfirmManovrSchema>;

/**
 * شِمای بستن دسته‌جمعی (گروهی) مانورها
 */
export const bulkFinishManovrSchema = z.object({
  ids: z
    .array(z.number().int().positive("شناسه مانور باید عدد مثبت باشد"))
    .min(1, "حداقل یک مانور باید انتخاب شود"),
});

export type BulkFinishManovrInput = z.infer<typeof bulkFinishManovrSchema>;

/**
 * شِمای حذف دسته‌جمعی (گروهی) مانورها
 */
export const bulkDeleteManovrSchema = z.object({
  ids: z
    .array(z.number().int().positive("شناسه مانور باید عدد مثبت باشد"))
    .min(1, "حداقل یک مانور باید انتخاب شود"),
});

export type BulkDeleteManovrInput = z.infer<typeof bulkDeleteManovrSchema>;

