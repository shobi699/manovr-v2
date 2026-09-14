<#
.SYNOPSIS
    اسکریپت خودکار ایجاد میانبر دسکتاپ کلاینت‌ها جهت اجرای سامانه مانور از روی پوشه اشتراکی شبکه
    Enterprise Desktop Shortcut Provisioning Script for Manovr V3 Network Portable
.DESCRIPTION
    این اسکریپت یک میانبر استاندارد با فلگ‌های بهینه‌ساز کرومیوم بر روی دسکتاپ کاربر فعلی
    ایجاد می‌کند تا بدون نیاز به نصب یا دسترسی ادمین، برنامه مستقیماً از روی پوشه شبکه اجرا شود.
#>

param (
    [string]$ServerSharePath = ""
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  سامانه مدیریت، پایش و هدایت هوشمند عملیات مانور دپو (Manovr V3)  " -ForegroundColor Yellow
Write-Host "  اسکریپت ایجاد خودکار میانبر دسترسی مستقیم تحت شبکه کلاینت‌ها      " -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan

# ۱. تعیین مسیر فایل اجرایی در شبکه
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$detectedExe = Join-Path $scriptDir "ManovrSystem.exe"

$targetExePath = ""
if ($ServerSharePath -ne "" -and (Test-Path $ServerSharePath)) {
    $targetExePath = $ServerSharePath
} elseif (Test-Path $detectedExe) {
    $targetExePath = $detectedExe
} else {
    # مسیر پیش‌فرض فایل‌سرور پایانه فتح‌آباد
    $defaultCorporatePath = "\\srvdfs01\Line1\Depo\ManovrSystem\ManovrSystem.exe"
    if (Test-Path $defaultCorporatePath) {
        $targetExePath = $defaultCorporatePath
    } else {
        $targetExePath = $defaultCorporatePath
    }
}

Write-Host "`n[*] مسیر فایل اجرایی هدف در شبکه:" -ForegroundColor White
Write-Host "    $targetExePath" -ForegroundColor Gray

# ۲. ایجاد و آماده‌سازی دایرکتوری داده‌های محلی کاربر در کلاینت
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
$clientLocalDir = Join-Path $localAppData "ManovrSystem"

if (-not (Test-Path $clientLocalDir)) {
    New-Item -ItemType Directory -Path $clientLocalDir -Force | Out-Null
}

# ۳. تنظیمات میانبر در دسکتاپ کاربر
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutFile = Join-Path $desktopPath "سامانه مدیریت مانور دپو.lnk"

try {
    $wshShell = New-Object -ComObject WScript.Shell
    $shortcut = $wshShell.CreateShortcut($shortcutFile)
    
    $shortcut.TargetPath = $targetExePath
    
    # فلگ‌های بهینه‌ساز عملکرد کرومیوم برای لود سریع و کاهش تاخیر شبکه
    $runtimeFlags = "--disable-gpu-sandbox --no-sandbox --disable-background-networking --disable-features=RendererCodeIntegrity --js-flags=""--max-old-space-size=1024"""
    $shortcut.Arguments = $runtimeFlags
    
    # نکته بحرانی: تنظیم WorkingDirectory روی مسیر محلی تا خطای UNC CWD در ویندوز رخ ندهد
    $shortcut.WorkingDirectory = $clientLocalDir
    
    # تنظیم آیکون میانبر از فایل اجرایی
    $shortcut.IconLocation = "$targetExePath,0"
    $shortcut.Description = "سامانه مدیریت و پایش هوشمند عملیات دپو و خطوط ریلی — شرکت بهره‌برداری متروی تهران"
    $shortcut.WindowStyle = 1 # Normal Window
    
    $shortcut.Save()

    Write-Host "`n[+] میانبر دسکتاپ با موفقیت ایجاد گردید:" -ForegroundColor Green
    Write-Host "    $shortcutFile" -ForegroundColor Yellow
    Write-Host "`n[i] مشخصات پیکربندی‌شده میانبر:" -ForegroundColor Cyan
    Write-Host "    - مسیر باینری شبکه (Target): $targetExePath" -ForegroundColor Gray
    Write-Host "    - دایرکتوری کاری محلی (Working Dir): $clientLocalDir" -ForegroundColor Gray
    Write-Host "    - فلگ‌های شتاب‌بخش (Arguments): $runtimeFlags" -ForegroundColor Gray
    Write-Host "`nعملیات با موفقیت پایان یافت. هم‌اکنون می‌توانید از روی دسکتاپ وارد سامانه شوید." -ForegroundColor Green
} catch {
    Write-Host "`n[-] خطا در ساخت میانبر دسکتاپ: $_" -ForegroundColor Red
    exit 1
}
