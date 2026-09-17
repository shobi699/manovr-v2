@echo off
chcp 65001 >nul
title سامانه مانور - تست و عیب‌یابی دسترسی شبکه و دیتابیس
color 0b

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-database-permissions.ps1"

if %ERRORLEVEL% neq 0 (
    echo.
    echo خطایی در اجرای اسکریپت رخ داد.
    pause
)
