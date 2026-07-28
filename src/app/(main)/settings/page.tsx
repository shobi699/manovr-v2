import { getSession } from "@/lib/auth";
import { getUserSetting, DEFAULT_APPEARANCE, DEFAULT_DEPOT } from "@/lib/settings";
import SettingsFormClient from "./SettingsFormClient";
import { Terminal } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  const appearance = session
    ? await getUserSetting(session.id, "appearance", DEFAULT_APPEARANCE)
    : DEFAULT_APPEARANCE;

  const depotPrefs = session
    ? await getUserSetting(session.id, "depot", DEFAULT_DEPOT)
    : DEFAULT_DEPOT;

  return (
    <>
      <div className="topbar">
        <h1>تنظیمات شخصی‌سازی و تم</h1>
      </div>
      <div className="content" style={{ maxWidth: 800 }}>
        <div className="card">
          <div className="card-head">
            <h2>شخصی‌سازی نمای نرم‌افزار و چیدمان</h2>
          </div>
          <div className="card-body">
            <SettingsFormClient initialAppearance={appearance} initialDepot={depotPrefs} />
          </div>
        </div>
      </div>
    </>
  );
}
