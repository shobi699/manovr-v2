/**
 * ارسال اعلانات نیتیو دسکتاپ (فراخوانی IPC الکترون یا مرورگر استاندارد)
 */
export async function showDesktopNotification(title: string, body: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // ۱. اولویت اول: محیط الکترون (IPC bridge)
  if ((window as any).electronAPI?.showNotification) {
    try {
      await (window as any).electronAPI.showNotification({ title, body });
      return true;
    } catch {
      // ادامه به عنوان fallback
    }
  }

  // ۲. اولویت دوم: Web Notification API مرورگر
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(title, { body });
      return true;
    } else if (Notification.permission !== "denied") {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          new Notification(title, { body });
          return true;
        }
      } catch {}
    }
  }

  return false;
}
