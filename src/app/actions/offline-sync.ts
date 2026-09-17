"use server";

import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import {
  getOfflineSyncStatus,
  syncOfflineActionsToServer,
  getOfflineQueue,
  OfflineSyncStatus,
} from "@/lib/offline-sync";

export async function getOfflineSyncStatusAction(): Promise<OfflineSyncStatus> {
  return await getOfflineSyncStatus();
}

export async function triggerManualSyncAction(): Promise<{
  success: boolean;
  syncedCount: number;
  message: string;
}> {
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      syncedCount: 0,
      message: "ابتدا باید وارد سامانه شوید.",
    };
  }

  return await syncOfflineActionsToServer();
}
