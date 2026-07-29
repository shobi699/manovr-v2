import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  // ۱. واکشی اطلاعات پرسنلی کاربر
  const user = await prisma.personnel.findUnique({
    where: { id: session.id },
    include: { accessRole: true },
  });

  if (!user) redirect("/login");

  // ۲. محاسبه آمارهای شخصی
  const [manovrsCreated, activeTickets, totalTickets] = await Promise.all([
    prisma.manovr.count({
      where: { creatorId: session.id },
    }),
    prisma.ticket.count({
      where: { creatorId: session.id, status: "open" },
    }),
    prisma.ticket.count({
      where: { creatorId: session.id },
    }),
  ]);

  const resolvedParams = (await searchParams) || {};
  const logPage = parseInt(resolvedParams.logPage as string) || 1;
  const logsPerPage = 10;
  const skipLogs = (logPage - 1) * logsPerPage;

  // ۳. واکشی آخرین لاگ‌های فعالیت کاربر با صفحه‌بندی
  const [recentLogs, totalLogsCount] = await Promise.all([
    prisma.auditLog.findMany({
      where: { actorId: session.id },
      orderBy: { createdAt: "desc" },
      skip: skipLogs,
      take: logsPerPage,
    }),
    prisma.auditLog.count({
      where: { actorId: session.id },
    }),
  ]);

  return (
    <div>
      <div className="topbar">
        <h1>پروفایل کاربری من</h1>
      </div>
      <div className="content">
        <ProfileClient
          user={{
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            userName: user.userName || "",
            role: user.role,
            shift: user.shift,
            orgPosition: user.orgPosition,
            personnelCode: user.personnelCode || "—",
            phone1: user.phone1 || "",
            phone2: user.phone2 || "",
            internalTel: user.internalTel || "",
            address: user.address || "",
            avatarColor: user.avatarColor || "#4b5563",
            roleName: user.accessRole?.name || "",
          }}
          stats={{
            manovrsCreated,
            activeTickets,
            totalTickets,
          }}
          recentLogs={recentLogs.map((log) => ({
            id: log.id,
            action: log.action,
            summary: log.summary,
            createdAt: log.createdAt.toISOString(),
          }))}
          logPage={logPage}
          totalLogsCount={totalLogsCount}
        />
      </div>
    </div>
  );
}
