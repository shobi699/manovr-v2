"use client";

import { useLiveRefresh } from "@/hooks/useLiveRefresh";

export default function DashboardLiveRefresh() {
  useLiveRefresh(["manovr_changed", "train_changed"]);
  return null;
}
