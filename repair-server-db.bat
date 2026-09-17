@echo off
chcp 65001 >nul
title سامانه مانور - تعمیر و بهینه‌سازی دیتابیس شبکه سرور
color 0b

echo ======================================================================
echo    🛠️  سامانه مانور پایانه ریلی فتح‌آباد - ابزار آزادسازی و تعمیر دیتابیس
echo ======================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "REPAIR_JS=%SCRIPT_DIR%scripts\repair-network-db.mjs"
if not exist "%REPAIR_JS%" (
    if exist "%SCRIPT_DIR%repair-network-db.mjs" (
        set "REPAIR_JS=%SCRIPT_DIR%repair-network-db.mjs"
    )
)

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    color 0c
    echo [خطا] موتور Node.js روی این سیستم یافت نشد.
    echo این اسکریپت تخصصی تغییر ژورنال SQLite نیاز به اجرای موتور Node.js دارد.
    echo لطفاً این اسکریپت را از روی سیستمی که Node.js دارد یا سیستم سرور اجرا نمایید،
    echo یا جهت تست دسترسی، ابزار check-database-permissions.bat را اجرا فرمایید.
    echo.
    pause
    exit /b 1
)

set "DEFAULT_DFS=\\srvdfs01\Line1\Depo\data\database\dev.db"

echo [1/3] در حال بررسی اتصال به پوشه سرور شبکه (%DEFAULT_DFS%)...
if exist "%DEFAULT_DFS%" (
    echo [موفق] پوشه سرور دپو با موفقیت شناسایی شد.
    set "TARGET_PATH=%DEFAULT_DFS%"
) else (
    echo [توجه] مسیر سرور شبکه در حال حاضر مستقیماً در دسترس نیست.
    echo در حال بررسی فایل محلی پروژه یا manovr-config.json...
    set "TARGET_PATH="
)

echo.
echo [2/3] در حال اجرای عملیات پاکسازی قفل‌ها و تبدیل ژورنال به TRUNCATE...
echo.

if defined TARGET_PATH (
    node "%REPAIR_JS%" "%TARGET_PATH%"
) else (
    node "%REPAIR_JS%"
)

if %ERRORLEVEL% equ 0 (
    color 0a
    echo.
    echo ======================================================================
    echo    ✅ عملیات با موفقیت ۱۰۰٪ به پایان رسید!
    echo    پایگاه داده هم‌اکنون در پایدارترین حالت (TRUNCATE) آماده استفاده کلاینت‌هاست.
    echo ======================================================================
) else (
    color 0c
    echo.
    echo ======================================================================
    echo    ❌ در اجرای عملیات خطایی رخ داد.
    echo    لطفاً بررسی فرمایید که شبکه به سرور متصل بوده و برنامه در سایر سیستم‌ها بسته باشد.
    echo ======================================================================
)

echo.
echo برای بستن این پنجره یک کلید را فشار دهید...
pause >nul
