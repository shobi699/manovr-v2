import React from "react";
import { getBackupsList, getBackupSettings } from "@/app/actions/backup";
import BackupClient from "./BackupClient";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function BackupPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const backups = await getBackupsList();
  const settings = await getBackupSettings();

  return (
    <div>
      <div className="topbar">
        <h1>پشتیبان‌گیری و امنیت داده‌ها</h1>
      </div>
      <div className="content">
        <BackupClient initialBackups={backups} initialSettings={settings} userRole={session.role} />
      </div>
    </div>
  );
}
