import { NextResponse } from "next/server";
import { getNetworkStatus } from "@/lib/network-status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getNetworkStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json(
      {
        isShared: false,
        isDatabaseReady: false,
        targetSharedPath: "\\\\srvdfs01\\Line1\\Depo\\data",
        activeDatabasePath: "خطا در بررسی",
        storageSource: "ناشناخته",
        pingMs: -1,
        sharedPathAccessible: false,
        serverHostname: "",
        checkedAt: new Date().toISOString(),
        error: error?.message || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
