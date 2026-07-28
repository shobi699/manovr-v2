"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action}>
      {state?.error && <div className="err">{state.error}</div>}
      <div className="field">
        <label htmlFor="userName">نام کاربری</label>
        <input id="userName" name="userName" className="input" autoFocus autoComplete="username" />
      </div>
      <div className="field">
        <label htmlFor="password">رمز عبور</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" />
      </div>
      <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} disabled={pending}>
        {pending ? "در حال ورود…" : "ورود"}
      </button>
    </form>
  );
}
