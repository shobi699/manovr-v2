import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * پل الکترون از سه قطعه تشکیل شده که باید همزمان درست باشند:
 *   preload.js  →  contextBridge سطح electronAPI را افشا می‌کند
 *   main.js     →  آن preload را به BrowserWindow وصل و کانال IPC را ثبت می‌کند
 *   package.json→  preload.js را در بسته نصبی قرار می‌دهد
 *
 * اگر هر کدام جا بیفتد، قابلیت بدون هیچ خطایی از کار می‌افتد: window.electronAPI
 * وجود نخواهد داشت و کد رندرر بی‌صدا به Web Notification برمی‌گردد.
 * دقیقاً همین اتفاق پیش از این افتاده بود — این تست جلوی تکرارش را می‌گیرد.
 */

const preload = readFileSync("preload.js", "utf8");
const main = readFileSync("main.js", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

describe("electron preload bridge wiring", () => {
  it("preload exposes electronAPI through contextBridge", () => {
    expect(preload).toContain("contextBridge.exposeInMainWorld");
    expect(preload).toMatch(/exposeInMainWorld\(\s*['"]electronAPI['"]/);
    expect(preload).toContain("showNotification");
  });

  it("preload never exposes raw ipcRenderer to the page", () => {
    // افشای مستقیم ipcRenderer عملاً معادل روشن کردن nodeIntegration است
    expect(preload).not.toMatch(/exposeInMainWorld\([^)]*,\s*ipcRenderer\s*\)/);
    expect(preload).not.toMatch(/invoke:\s*ipcRenderer\.invoke/);
  });

  it("main.js attaches the preload script to the BrowserWindow", () => {
    expect(main).toMatch(/preload:\s*path\.join\(__dirname,\s*['"]preload\.js['"]\)/);
  });

  it("main.js keeps context isolation on and node integration off", () => {
    // contextBridge بدون contextIsolation کار نمی‌کند
    expect(main).toMatch(/contextIsolation:\s*true/);
    expect(main).toMatch(/nodeIntegration:\s*false/);
  });

  it("the IPC channel name matches on both sides of the bridge", () => {
    const preloadChannels = [...preload.matchAll(/ipcRenderer\.invoke\(\s*['"]([^'"]+)['"]/g)].map(
      (m) => m[1]
    );
    const mainChannels = [...main.matchAll(/ipcMain\.handle\(\s*['"]([^'"]+)['"]/g)].map(
      (m) => m[1]
    );

    expect(preloadChannels.length).toBeGreaterThan(0);
    expect(mainChannels.length).toBeGreaterThan(0);
    // هر کانالی که رندرر صدا می‌زند باید در پروسه اصلی handler داشته باشد
    for (const channel of preloadChannels) {
      expect(mainChannels).toContain(channel);
    }
  });

  it("preload.js is included in the packaged installer", () => {
    // بدون این ورودی، preload در نسخه بسته‌بندی‌شده وجود ندارد و قابلیت فقط
    // در محیط توسعه کار می‌کند — یک شکست خاموش که فقط پس از انتشار دیده می‌شود
    expect(pkg.build.files).toContain("preload.js");
  });

  it("the notification handler validates its payload instead of destructuring it", () => {
    // payload از رندرر می‌آید؛ destructuring مستقیم روی undefined پرتاب می‌کند
    expect(main).not.toMatch(/ipcMain\.handle\([^)]*\(event,\s*\{\s*title/);
    expect(main).toMatch(/typeof payload\?\.title === ['"]string['"]/);
  });

  it("the notification handler rejects senders other than the main window", () => {
    expect(main).toMatch(/event\.sender !== mainWindow\.webContents/);
  });
});
