import { NextResponse } from "next/server";
import { getOfflineQueue, getOfflineSyncStatus, syncOfflineActionsToServer } from "@/lib/offline-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const queue = await getOfflineQueue();
    const status = await getOfflineSyncStatus();

    return NextResponse.json({
      success: true,
      ...status,
      queueSummary: queue.map((item) => ({
        id: item.id,
        actionType: item.actionType,
        timestamp: item.timestamp,
        userFullName: item.userFullName,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = await syncOfflineActionsToServer();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        syncedCount: 0,
        message: error?.message || "خطای ناشناخته در همگام‌سازی",
      },
      { status: 500 }
    );
  }
}
