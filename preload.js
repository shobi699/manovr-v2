// پل امن میان رندرر و پروسه اصلی الکترون.
//
// این فایل تنها راه دسترسی رندرر به قابلیت‌های نیتیو است. با فعال بودن
// contextIsolation، متغیرهای این اسکریپت به صفحه نشت نمی‌کنند و فقط چیزی که
// صراحتاً از طریق contextBridge افشا شود در دسترس قرار می‌گیرد.
//
// اصل راهنما: سطح افشاشده را حداقلی و اعتبارسنجی‌شده نگه دارید. هرگز کل
// ipcRenderer یا یک تابع عمومی invoke را افشا نکنید — این کار عملاً معادل
// روشن کردن nodeIntegration است.
const { contextBridge, ipcRenderer } = require('electron');

// سقف طول ورودی‌ها تا یک رندرر معیوب نتواند رشته‌ی بسیار بزرگ به API نیتیو بدهد
const MAX_TITLE = 120;
const MAX_BODY = 500;

function asBoundedString(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.slice(0, maxLength);
}

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * نمایش اعلان نیتیو سیستم‌عامل.
   * ورودی پیش از عبور از پل اعتبارسنجی می‌شود.
   */
  showNotification: (payload) =>
    ipcRenderer.invoke('show-notification', {
      title: asBoundedString(payload && payload.title, MAX_TITLE),
      body: asBoundedString(payload && payload.body, MAX_BODY),
    }),
});
