import { z } from "zod";
import {
  requiredString,
  optionalString,
  requiredNumber,
  numberWithDefault,
  booleanWithDefault,
} from "./common";

/**
 * شِمای ایجاد خط جدید
 */
export const createLineSchema = z.object({
  name: requiredString("نام خط"),
  tag: optionalString,
  capacity: numberWithDefault(1, 1),
  terminal: requiredNumber("ترمینال", 1),
  isDynamic: booleanWithDefault(false),
  posX: numberWithDefault(0),
  posY: numberWithDefault(0),
  rotation: numberWithDefault(0),
  length: numberWithDefault(30),
});

export type CreateLineInput = z.infer<typeof createLineSchema>;

/**
 * شِمای ویرایش خط
 */
export const updateLineSchema = z.object({
  id: requiredNumber("شناسه خط", 1),
  name: requiredString("نام خط"),
  tag: optionalString,
  capacity: numberWithDefault(1, 1),
  terminal: requiredNumber("ترمینال", 1),
  isDynamic: booleanWithDefault(false),
  isActive: booleanWithDefault(true),
  posX: numberWithDefault(0),
  posY: numberWithDefault(0),
  rotation: numberWithDefault(0),
  length: numberWithDefault(30),
});

export type UpdateLineInput = z.infer<typeof updateLineSchema>;
