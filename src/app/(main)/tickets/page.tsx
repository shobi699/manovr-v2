import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getTicketsList } from "@/app/actions/tickets";
import TicketsClient from "./TicketsClient";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const res = await getTicketsList();
  const initialTickets = res.ok && res.data ? res.data : [];

  return (
    <div>
      <div className="topbar">
        <h1>تیکت‌های پشتیبانی و عملیاتی</h1>
      </div>
      <div className="content">
        <TicketsClient
          initialTickets={initialTickets}
          currentUser={{
            id: session.id,
            fullName: session.fullName,
            role: session.role,
          }}
        />
      </div>
    </div>
  );
}
