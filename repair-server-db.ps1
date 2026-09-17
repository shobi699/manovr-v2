# PowerShell Script for Database Repair and Lock Release
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   🛠️  سامانه مانور - ابزار هوشمند آزادسازی و تعمیر دیتابیس شبکه" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$defaultDfsPath = "\\srvdfs01\Line1\Depo\data\database\dev.db"
$targetDb = $null

Write-Host "[1/3] بررسی دسترسی به پوشه اشتراکی شبکه سرور ($defaultDfsPath)..." -ForegroundColor Yellow

if (Test-Path $defaultDfsPath) {
    Write-Host "   ✅ پوشه اشتراکی سرور در دسترس است: $defaultDfsPath" -ForegroundColor Green
    $targetDb = $defaultDfsPath
} else {
    Write-Host "   ℹ️ مسیر پیش‌فرض سرور شناسایی نشد. بررسی فایل تنظیمات محلی..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[2/3] در حال اجرای اسکریپت بهینه‌سازی دیتابیس..." -ForegroundColor Yellow
Write-Host ""

if ($targetDb) {
    node scripts/repair-network-db.mjs "$targetDb"
} else {
    node scripts/repair-network-db.mjs
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host "   ✅ عملیات با موفقیت پایان یافت! دیتابیس در حالت TRUNCATE تثبیت شد." -ForegroundColor Green
    Write-Host "======================================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Red
    Write-Host "   ❌ بروز خطا در اعمال تغییرات دیتابیس." -ForegroundColor Red
    Write-Host "======================================================================" -ForegroundColor Red
}

Write-Host ""
Write-Host "پایان عملیات." -ForegroundColor Gray
