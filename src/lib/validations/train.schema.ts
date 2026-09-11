import { z } from "zod";
import {
  requiredString,
  requiredNumber,
  numberWithDefault,
  optionalNumber,
  booleanWithDefault,
} from "./common";

/**
 * شِمای ایجاد قطار جدید
 */
export const createTrainSchema = z.object({
  code: requiredString("کد قطار"),
  type: requiredNumber("نوع قطار"),
  lineId: optionalNumber,
  slotIndex: numberWithDefault(0),
  hasKafshak: booleanWithDefault(false),
  noAtp: booleanWithDefault(false),
  movadDavvar: z
    .preprocess((val) => {
      if (val === "A" || val === "B" || val === "C") return val;
      return null;
    }, z.enum(["A", "B", "C"]).nullable().optional())
    .transform((val) => val ?? null),
  noLicense: booleanWithDefault(false),
});

export type CreateTrainInput = z.infer<typeof createTrainSchema>;

/**
 * شِمای ویرایش قطار
 */
export const updateTrainSchema = z.object({
  id: requiredNumber("شناسه قطار", 1),
  code: requiredString("کد قطار"),
  type: requiredNumber("نوع قطار"),
  lineId: optionalNumber,
  slotIndex: optionalNumber,
  isDisposed: booleanWithDefault(false),
  hasKafshak: booleanWithDefault(false),
  noAtp: booleanWithDefault(false),
  movadDavvar: z
    .preprocess((val) => {
      if (val === "A" || val === "B" || val === "C") return val;
      return null;
    }, z.enum(["A", "B", "C"]).nullable().optional())
    .transform((val) => val ?? null),
  noLicense: booleanWithDefault(false),
});

export type UpdateTrainInput = z.infer<typeof updateTrainSchema>;
