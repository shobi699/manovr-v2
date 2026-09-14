"use client";

import React, { useActionState, useState } from "react";
import { ORG_POSITIONS } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { createUser } from "@/app/actions/user";
import { OrgPosition, Shift, PersonnelType } from "@/lib/enums";

interface LookupItem {
  code: number;
  label: string;
  isActive?: boolean;
}

export default function NewUserForm({
  roles = [],
  currentUser,
  orgPositions = [],
  shifts = [],
  systemRoles = [],
}: {
  roles: { id: number; name: string }[];
  currentUser?: {
    id: number;
    shift: number;
    orgPosition: number;
    personnelType: number;
    role: number;
  } | null;
  orgPositions?: LookupItem[];
  shifts?: LookupItem[];
  systemRoles?: LookupItem[];
}) {
  const [state, action, pending] = useActionState(createUser, null);
  const [hasAcc, setHasAcc] = useState(false);
  const router = useRouter();

  // تولید رنگ رندوم آواتار به عنوان مقدار اولیه
  const [avatarCol, setAvatarCol] = useState(
    () => "hsla(" + Math.floor(Math.random() * 360) + ", 70%, 45%, 0.85)"
  );
  const [selectedOrgPosition, setSelectedOrgPosition] = useState<number>(4);
  const [isPartTimeDriver, setIsPartTimeDriver] = useState<boolean>(false);

  const isShiftSupervisor = currentUser?.orgPosition === ORG_POSITIONS.RESPONSIBLE;

  return (
    <form action={action}>
      {state?.error && <div className="err">{state.error}</div>}

      <h3 style={{ borderBottom: "1px solid var(--line)", paddingBottom: "6px", fontWeight: "700", marginBottom: "16px" }}>
        اطلاعات پرسنلی
      </h3>

      <div className="grid2">
        <div className="field">
          <label htmlFor="firstName">نام *</label>
          <input id="firstName" name="firstName" className="input" required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="lastName">نام خانوادگی *</label>
          <input id="lastName" name="lastName" className="input" required />
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="personnelCode">کد پرسنلی</label>
          <input id="personnelCode" name="personnelCode" className="input num" placeholder="مثال: ۱۲۳۴۵" />
        </div>
        <div className="field" />
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="orgPosition">پست سازمانی</label>
          <select
            id="orgPosition"
            name="orgPosition"
            className="input"
            value={selectedOrgPosition}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSelectedOrgPosition(val);
              if (val === 1) {
                setIsPartTimeDriver(false);
              }
            }}
          >
            {orgPositions && orgPositions.length > 0
              ? orgPositions
                  .filter((o) => o.isActive !== false && (!isShiftSupervisor || (o.code !== 2 && o.code !== 3)))
                  .map((o) => (
                    <option key={o.code} value={o.code}>{o.label}</option>
                  ))
              : Object.entries(OrgPosition)
                  .filter(([k]) => !isShiftSupervisor || (k !== "2" && k !== "3"))
                  .map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))
            }
          </select>
        </div>
        <div className="field">
          <label htmlFor="shift">شیفت</label>
          {isShiftSupervisor && currentUser ? (
            <>
              <input type="hidden" name="shift" value={currentUser.shift} />
              <select className="input" defaultValue={currentUser.shift} disabled>
                {shifts && shifts.length > 0
                  ? shifts.map((s) => (
                      <option key={s.code} value={s.code}>{s.label}</option>
                    ))
                  : Object.entries(Shift).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))
                }
              </select>
            </>
          ) : (
            <select id="shift" name="shift" className="input" defaultValue="1">
              {shifts && shifts.length > 0
                ? shifts
                    .filter((s) => s.isActive !== false)
                    .map((s) => (
                      <option key={s.code} value={s.code}>{s.label}</option>
                    ))
                : Object.entries(Shift).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))
              }
            </select>
          )}
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="personnelType">نوع پرسنل</label>
          {isShiftSupervisor && currentUser ? (
            <>
              <input type="hidden" name="personnelType" value={currentUser.personnelType} />
              <select className="input" defaultValue={currentUser.personnelType} disabled>
                {Object.entries(PersonnelType).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </>
          ) : (
            <select id="personnelType" name="personnelType" className="input" defaultValue="1">
              {Object.entries(PersonnelType).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          )}
        </div>
        <div className="field" style={{ alignSelf: "center", paddingTop: "14px" }}>
          {selectedOrgPosition === 1 ? (
            <div style={{ fontSize: "12px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "6px", background: "var(--panel-subtle, rgba(255,255,255,0.03))", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)" }}>
              <span>ℹ️</span>
              <span>سمت اصلی این کاربر «راهبر» است و به صورت دائم دارای صلاحیت راهبری می‌باشد.</span>
            </div>
          ) : (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                name="isPartTimeDriver"
                checked={isPartTimeDriver}
                onChange={(e) => setIsPartTimeDriver(e.target.checked)}
                style={{ width: "18px", height: "18px", marginTop: "2px", cursor: "pointer" }}
              />
              <div>
                <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>راهبر غیردائم</span>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted)" }}>
                  امکان انتخاب کاربر در مانورها بدون تغییر پست سازمانی اصلی
                </p>
              </div>
            </label>
          )}
        </div>
      </div>

      <h3 style={{ borderBottom: "1px solid var(--line)", paddingBottom: "6px", fontWeight: "700", margin: "20px 0 16px" }}>
        اطلاعات تماس (دفتر تلفن)
      </h3>

      <div className="grid2">
        <div className="field">
          <label htmlFor="phone1">شماره همراه ۱</label>
          <input id="phone1" name="phone1" className="input num" placeholder="مثال: ۰۹۱۲۳۴۵۶۷۸۹" />
        </div>
        <div className="field">
          <label htmlFor="phone2">شماره همراه ۲</label>
          <input id="phone2" name="phone2" className="input num" />
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="internalTel">تلفن داخلی پایانه</label>
          <input id="internalTel" name="internalTel" className="input num" />
        </div>
        <div className="field">
          <label htmlFor="avatarColor">رنگ آواتار (Hex/HSL)</label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="color"
              value={avatarCol.startsWith("hsl") ? "#d8842a" : avatarCol}
              onChange={(e) => setAvatarCol(e.target.value)}
              style={{ width: "40px", height: "40px", padding: 0, border: "0", cursor: "pointer", borderRadius: "4px" }}
            />
            <input
              id="avatarColor"
              name="avatarColor"
              type="text"
              className="input num"
              value={avatarCol}
              onChange={(e) => setAvatarCol(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </div>

      <div className="field">
        <label htmlFor="address">آدرس منزل</label>
        <textarea id="address" name="address" className="input" rows={2} />
      </div>

      <h3 style={{ borderBottom: "1px solid var(--line)", paddingBottom: "6px", fontWeight: "700", margin: "20px 0 16px" }}>
        حساب کاربری و سطوح دسترسی
      </h3>

      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            name="hasAccount"
            value="1"
            checked={hasAcc}
            onChange={(e) => setHasAcc(e.target.checked)}
          />
          <b>ایجاد حساب کاربری (دسترسی ورود به نرم‌افزار)</b>
        </label>
      </div>

      {hasAcc && (
        <div style={{ padding: "16px", backgroundColor: "var(--panel-2)", borderRadius: "var(--radius)", marginBottom: "16px" }}>
          <div className="grid2">
            <div className="field">
              <label htmlFor="userName">نام کاربری *</label>
              <input id="userName" name="userName" className="input" dir="ltr" required />
            </div>
            <div className="field">
              <label htmlFor="accessRoleId">نقش کاربری (سیستم دسترسی V3) *</label>
              <select
                id="accessRoleId"
                name="accessRoleId"
                className="input"
                defaultValue={roles.find((r) => r.name === "مشاهده")?.id ?? ""}
                required
              >
                <option value="" disabled>-- انتخاب نقش دسترسی سامانه --</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid2">
            <div className="field">
              <label htmlFor="password">رمز عبور (پیش‌فرض: ۱۲۳۴۵۶)</label>
              <input id="password" name="password" type="password" className="input" dir="ltr" defaultValue="123456" />
            </div>
            <div className="field" style={{ display: "flex", alignItems: "center", paddingTop: "24px" }}>
              <span className="muted" style={{ fontSize: "12px", lineHeight: "1.6" }}>
                دسترسی‌های ورود به سامانه و مجوزهای کاربر بر اساس نقش انتخاب‌شده V3 تعیین می‌شوند.
              </span>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button className="btn primary" disabled={pending}>
          {pending ? "در حال ثبت…" : "ثبت کاربر"}
        </button>
        <button type="button" className="btn" onClick={() => router.push("/users")}>
          انصراف
        </button>
      </div>
    </form>
  );
}
