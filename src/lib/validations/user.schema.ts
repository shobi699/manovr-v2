import { z } from "zod";
import {
  requiredString,
  optionalString,
  requiredNumber,
  numberWithDefault,
  optionalNumber,
  booleanWithDefault,
} from "./common";

/**
 * شِمای ایجاد کاربر جدید
 */
export const createUserSchema = z
  .object({
    firstName: requiredString("نام"),
    lastName: requiredString("نام خانوادگی"),
    userName: optionalString,
    password: z
      .string()
      .optional()
      .nullable()
      .transform((val) => (val ? val.trim() : "")),
    role: numberWithDefault(0, 0, 4),
    shift: numberWithDefault(1, 1, 3),
    orgPosition: numberWithDefault(4, 1, 4),
    personnelType: numberWithDefault(1, 1, 2),
    personnelCode: optionalString,
    hasAccount: booleanWithDefault(false),
    accessRoleId: optionalNumber,
    phone1: optionalString,
    phone2: optionalString,
    internalTel: optionalString,
    address: optionalString,
    avatarColor: optionalString,
  })
  .superRefine((data, ctx) => {
    if (data.hasAccount) {
      if (!data.userName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "نام کاربری برای حساب فعال الزامی است.",
          path: ["userName"],
        });
      }
      const pwd = data.password ? data.password.trim() : "";
      if (!pwd || pwd.length < 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "رمز عبور حداقل ۴ کاراکتر باشد.",
          path: ["password"],
        });
      }
    }
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * شِمای ویرایش کاربر
 */
export const updateUserSchema = z.object({
  id: requiredNumber("شناسه کاربر", 1),
  firstName: requiredString("نام"),
  lastName: requiredString("نام خانوادگی"),
  userName: optionalString,
  role: numberWithDefault(0, 0, 4),
  shift: numberWithDefault(1, 1, 3),
  orgPosition: numberWithDefault(4, 1, 4),
  personnelType: numberWithDefault(1, 1, 2),
  personnelCode: optionalString,
  hasAccount: booleanWithDefault(false),
  accessRoleId: optionalNumber,
  phone1: optionalString,
  phone2: optionalString,
  internalTel: optionalString,
  address: optionalString,
  avatarColor: optionalString,
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * شِمای تغییر یا بازنشانی رمز عبور
 */
export const resetPasswordSchema = z.object({
  userId: requiredNumber("شناسه کاربر", 1),
  password: z
    .string({
      error: "رمز عبور الزامی است.",
    })
    .trim()
    .min(4, "رمز عبور حداقل ۴ کاراکتر باشد."),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * شِمای ورود به سامانه
 */
export const loginSchema = z.object({
  userName: requiredString("نام کاربری"),
  password: z
    .string({
      error: "رمز عبور را وارد نمایید.",
    })
    .min(1, "رمز عبور را وارد نمایید."),
});

export type LoginInput = z.infer<typeof loginSchema>;
