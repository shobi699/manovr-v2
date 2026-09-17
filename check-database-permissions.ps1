# PowerShell Diagnostic Tool for Depo Database & Network Permissions
# سامانه مدیریت پایانه و مانور فتح‌آباد - ابزار عیب‌یابی دسترسی شبکه و دیتابیس
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   🔍 سامانه مانور فتح‌آباد - ابزار جامع عیب‌یابی دسترسی شبکه و دیتابیس" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $scriptDir "manovr-config.json"
if (-not (Test-Path $configPath)) {
    $configPath = Join-Path (Get-Location) "manovr-config.json"
}

$sharedPath = "\\srvdfs01\Line1\Depo\data"
if (Test-Path $configPath) {
    try {
        $cfg = Get-Content $configPath -Raw | ConvertFrom-Json
        if ($cfg.sharedDataPath) { $sharedPath = $cfg.sharedDataPath }
    } catch {}
}

Write-Host "📍 مسیر پوشه اشتراکی تعریف‌شده: $sharedPath" -ForegroundColor White
Write-Host ""

$errorsCount = 0

# ۱. بررسی دسترسی شبکه و پروتکل اشتراک فایل (SMB)
Write-Host "[۱/۵] بررسی اتصال به سرور و پوشه اشتراکی شبکه..." -ForegroundColor Yellow
if (Test-Path $sharedPath) {
    Write-Host "   ✅ پوشه اشتراکی شبکه در دسترس است." -ForegroundColor Green
} else {
    Write-Host "   ❌ خطای عدم دسترسی: مسیر پوشه سرور ($sharedPath) از این رایانه قابل رویت نیست." -ForegroundColor Red
    Write-Host "      💡 راهکار: بررسی کنید که کابل شبکه متصل است و نام کاربری ویندوز به سرور لاگین است." -ForegroundColor Gray
    $errorsCount++
}

# ۲. بررسی فایل پایگاه داده مرکزی
Write-Host ""
Write-Host "[۲/۵] بررسی وجود فایل دیتابیس مرکزی (dev.db)..." -ForegroundColor Yellow
$dbCandidate1 = Join-Path $sharedPath "database\dev.db"
$dbCandidate2 = Join-Path $sharedPath "dev.db"
$targetDb = $null

if (Test-Path $dbCandidate1) {
    $targetDb = $dbCandidate1
    Write-Host "   ✅ فایل دیتابیس در مسیر زیر تایید شد: $targetDb" -ForegroundColor Green
} elseif (Test-Path $dbCandidate2) {
    $targetDb = $dbCandidate2
    Write-Host "   ✅ فایل دیتابیس در مسیر زیر تایید شد: $targetDb" -ForegroundColor Green
} else {
    Write-Host "   ⚠️ فایل dev.db در پوشه اشتراکی سرور یافت نشد." -ForegroundColor Yellow
    Write-Host "      💡 راهکار: فایل الگوی dev.db را از بسته نرم‌افزار در پوشه data\database سرور کپی کنید." -ForegroundColor Gray
    $errorsCount++
}

# ۳. بررسی مجوز خواندن و نوشتن (Read/Write & NTFS Modify)
Write-Host ""
Write-Host "[۳/۵] بررسی مجوزهای نوشتن و اصلاح (NTFS Modify / SMB Write)..." -ForegroundColor Yellow
$testFolder = if ($targetDb) { Split-Path -Parent $targetDb } else { $sharedPath }
if (Test-Path $testFolder) {
    $testFile = Join-Path $testFolder (".manovr_perm_test_" + [Guid]::NewGuid().ToString().Substring(0, 8) + ".tmp")
    try {
        [System.IO.File]::WriteAllText($testFile, "MANOVR_PERM_OK")
        if (Test-Path $testFile) {
            Remove-Item $testFile -Force -ErrorAction SilentlyContinue
            Write-Host "   ✅ مجوز نوشتن (Write/Modify) در پوشه سرور با موفقیت تایید شد." -ForegroundColor Green
        }
    } catch {
        Write-Host "   ❌ خطای مجوز نوشتن: کاربر جاری دسترسی Modify/Write در پوشه اشتراکی را ندارد!" -ForegroundColor Red
        Write-Host "      پیام سیستم: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "      💡 راهکار: به ادمین شبکه سرور اطلاع دهید تا دسترسی 'Modify' و 'Read' پوشه را به پرسنل دپو اعطا نماید." -ForegroundColor Gray
        $errorsCount++
    }
} else {
    Write-Host "   ⏭️ به دلیل عدم دسترسی به مسیر سرور، تست نوشتن امکان‌پذیر نیست." -ForegroundColor DarkGray
}

# ۴. بررسی قفل انحصاری یا فایل‌های سرگردان WAL و SHM
Write-Host ""
Write-Host "[۴/۵] بررسی فایل‌های قفل و حالت ژورنال SQLite..." -ForegroundColor Yellow
if ($targetDb -and (Test-Path $targetDb)) {
    $dir = Split-Path -Parent $targetDb
    $baseName = Split-Path -Leaf $targetDb
    $walPath = Join-Path $dir "$baseName-wal"
    $shmPath = Join-Path $dir "$baseName-shm"

    if (Test-Path $walPath) {
        Write-Host "   ⚠️ فایل موقت ژورنال ($baseName-wal) مشاهده شد (احتمالاً دیتابیس در حالت WAL است)." -ForegroundColor Yellow
        Write-Host "      💡 توصیه: اجرای اسکریپت repair-server-db.bat جهت تبدیل ژورنال به TRUNCATE الزامی است." -ForegroundColor Gray
    } else {
        Write-Host "   ✅ فایل سرگردان wal وجود ندارد." -ForegroundColor Green
    }

    if (Test-Path $shmPath) {
        Write-Host "   ⚠️ فایل حافظه اشتراکی ($baseName-shm) مشاهده شد." -ForegroundColor Yellow
    } else {
        Write-Host "   ✅ فایل سرگردان shm وجود ندارد." -ForegroundColor Green
    }

    # تست باز کردن فایل دیتابیس با FileShare.ReadWrite
    try {
        $stream = [System.IO.File]::Open($targetDb, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        $stream.Close()
        Write-Host "   ✅ فایل dev.db قفل انحصاری مسدودکننده ندارد و توسط کلاینت‌ها قابل بازگشایی است." -ForegroundColor Green
    } catch {
        Write-Host "   ❌ فایل دیتابیس توسط پردازه دیگری به صورت انحصاری قفل شده است: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "      💡 راهکار: نرم‌افزار را در تمام سیستم‌ها بسته و سپس repair-server-db.bat را اجرا فرمایید." -ForegroundColor Gray
        $errorsCount++
    }
}

# ۵. نتیجه‌گیری نهایی
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
if ($errorsCount -eq 0) {
    Write-Host "   🎉 تمامی بررسی‌ها موفقیت‌آمیز بود! محیط شبکه برای اجرای نرم‌افزار کاملاً مهیاست." -ForegroundColor Green
} else {
    Write-Host "   ⚠️ تعداد $errorsCount مورد نیازمند توجه شناسایی شد. لطفاً راهکارهای بالا را اعمال فرمایید." -ForegroundColor Yellow
}
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "جهت خروج، یک کلید را فشار دهید..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
