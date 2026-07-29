import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { showDesktopNotification } from "@/lib/electron-notify";

describe("showDesktopNotification helper", () => {
  const originalWindow = global.window;

  afterEach(() => {
    global.window = originalWindow;
  });

  it("returns false in SSR server environment", async () => {
    // @ts-ignore
    delete global.window;
    const res = await showDesktopNotification("تست", "متن تست");
    expect(res).toBe(false);
  });

  it("invokes electronAPI when present in window", async () => {
    const mockShowNotif = vi.fn().mockResolvedValue({ ok: true });
    global.window = {
      electronAPI: {
        showNotification: mockShowNotif,
      },
    } as any;

    const res = await showDesktopNotification("عنوان الکترون", "متن الکترون");
    expect(res).toBe(true);
    expect(mockShowNotif).toHaveBeenCalledWith({
      title: "عنوان الکترون",
      body: "متن الکترون",
    });
  });
});
