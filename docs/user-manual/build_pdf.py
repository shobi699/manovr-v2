import os
import webbrowser
import markdown

# ترتیب صحیح فصول و اسناد
FILES = [
    "00_OVERVIEW_AND_ARCHITECTURE.md",
    "01_DEPOT_OPERATIONS.md",
    "02_BASE_DATA_FLEET.md",
    "03_ANALYTICS_AND_SUPPORT.md",
    "04_ADMIN_MANAGEMENT.md",
]

OUTPUT_HTML = "Manovr_V3_Complete_Manual.html"

# قالب چاپی استاندارد با پشتیبانی کامل از زبان فارسی، چیدمان راست‌چین و صفحه جلد
HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>راهنمای جامع سامانه مانور V3 — پایانه فتح‌آباد</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700;800&display=swap" rel="stylesheet">
    <style>
        @page {
            size: A4;
            margin: 20mm 15mm 20mm 15mm;
            @bottom-center {
                content: counter(page);
                font-family: 'Vazirmatn', sans-serif;
                font-size: 9pt;
                color: #64748b;
            }
        }
        
        body {
            font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif;
            font-size: 10.5pt;
            line-height: 1.8;
            color: #1e293b;
            background-color: #ffffff;
            direction: rtl;
            text-align: justify;
            margin: 0;
            padding: 0;
        }

        /* صفحه جلد */
        .cover-page {
            height: 90vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            page-break-after: always;
            border: 2px solid #0284c7;
            padding: 40px;
            margin-bottom: 30px;
            background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
            border-radius: 8px;
        }
        .cover-title {
            font-size: 26pt;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 15px;
        }
        .cover-subtitle {
            font-size: 15pt;
            font-weight: 500;
            color: #0369a1;
            margin-bottom: 35px;
        }
        .cover-meta {
            font-size: 11pt;
            color: #475569;
            margin-top: 40px;
            line-height: 2;
        }

        /* تیترها و شکست صفحات */
        h1 {
            font-size: 18pt;
            font-weight: 800;
            color: #0f172a;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 8px;
            margin-top: 30px;
            page-break-before: always;
        }
        h2 {
            font-size: 14pt;
            font-weight: 700;
            color: #0369a1;
            margin-top: 22px;
            border-right: 4px solid #0284c7;
            padding-right: 8px;
        }
        h3 {
            font-size: 12pt;
            font-weight: 700;
            color: #334155;
            margin-top: 18px;
        }

        /* جدول‌ها */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 9.5pt;
            page-break-inside: avoid;
        }
        th, td {
            border: 1px solid #cbd5e1;
            padding: 8px 10px;
            text-align: right;
        }
        th {
            background-color: #0f172a;
            color: #ffffff;
            font-weight: 700;
        }
        tr:nth-child(even) {
            background-color: #f8fafc;
        }

        /* بلوک‌های کد و نقل‌قول */
        pre {
            background-color: #0f172a;
            color: #f8fafc;
            padding: 12px;
            border-radius: 6px;
            direction: ltr;
            text-align: left;
            overflow-x: auto;
            font-size: 9pt;
            page-break-inside: avoid;
        }
        code {
            font-family: Consolas, Monaco, monospace;
            background-color: #f1f5f9;
            color: #0f172a;
            padding: 2px 4px;
            border-radius: 4px;
            font-size: 9pt;
            direction: ltr;
            display: inline-block;
        }
        pre code {
            background: none;
            color: inherit;
            padding: 0;
        }
        blockquote {
            border-right: 4px solid #0284c7;
            background-color: #f0f9ff;
            margin: 15px 0;
            padding: 10px 15px;
            border-radius: 0 4px 4px 0;
            color: #0c4a6e;
        }

        ul, ol {
            padding-right: 25px;
        }
        li {
            margin-bottom: 6px;
        }

        @media print {
            body {
                background: none;
            }
            .cover-page {
                height: 98vh;
            }
        }
    </style>
</head>
<body>

<div class="cover-page">
    <div class="cover-title">سامانه جامع مدیریت خطوط و مانور پایانه فتح‌آباد</div>
    <div class="cover-subtitle">مستندات یکپارچه فنی، عملیاتی و راهنمای کاربری (Manovr V3)</div>
    <div style="width: 80px; height: 3px; background-color: #0284c7; margin: 20px auto;"></div>
    <div class="cover-meta">
        <strong>شرکت بهره‌برداری راه‌آهن شهری تهران و حومه</strong><br>
        معاونت عملیات و ناوگان — خط ۱ مترو تهران<br>
        <strong>کد سند:</strong> MANOVR-V3-DOC-MASTER<br>
        <strong>نسخه:</strong> ۳.۰.۰ سازمانی<br>
        <strong>شامل:</strong> کلیه فصول ۱ تا ۲۰ (بخش‌های ۱ تا ۴ و مشخصات زیرساختی)
    </div>
</div>

<div class="content">
__CONTENT__
</div>

</body>
</html>
"""

def main():
    combined_md = []
    
    for filename in FILES:
        if os.path.exists(filename):
            with open(filename, "r", encoding="utf-8") as f:
                combined_md.append(f.read())
                combined_md.append("\n\n---\n\n")
        else:
            print(f"هشدار: فایل {filename} یافت نشد.")

    raw_text = "".join(combined_md)
    html_body = markdown.markdown(raw_text, extensions=['tables', 'fenced_code'])
    final_html = HTML_TEMPLATE.replace("__CONTENT__", html_body)

    with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
        f.write(final_html)

    print(f"فایل تجمیعی با موفقیت در '{OUTPUT_HTML}' ایجاد شد.")
    webbrowser.open(os.path.abspath(OUTPUT_HTML))

if __name__ == "__main__":
    main()