const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const regFontPath = path.join(rootDir, 'public', 'fonts', 'Vazirmatn-Regular.woff2');
const boldFontPath = path.join(rootDir, 'public', 'fonts', 'Vazirmatn-Bold.woff2');

const regWoff2 = fs.readFileSync(regFontPath).toString('base64');
const boldWoff2 = fs.readFileSync(boldFontPath).toString('base64');

const htmlContent = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>سامانه مدیریت مانور دپو</title>
  <style>
    @font-face {
      font-family: 'Vazirmatn';
      src: url('data:font/woff2;charset=utf-8;base64,${regWoff2}') format('woff2'),
           url('public/fonts/Vazirmatn-Regular.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }

    @font-face {
      font-family: 'Vazirmatn';
      src: url('data:font/woff2;charset=utf-8;base64,${boldWoff2}') format('woff2'),
           url('public/fonts/Vazirmatn-Bold.woff2') format('woff2');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
      -webkit-app-region: drag;
      font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, Tahoma, sans-serif;
    }

    body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: transparent;
      display: flex;
      justify-content: center;
      align-items: center;
      direction: rtl;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .splash-card {
      width: 440px;
      height: 480px;
      background: rgba(15, 23, 42, 0.96);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7),
                  0 0 80px rgba(59, 130, 246, 0.18);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 30px;
      position: relative;
      color: #f8fafc;
    }

    .bg-glow {
      position: absolute;
      width: 280px;
      height: 280px;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.28) 0%, rgba(147, 51, 234, 0.16) 50%, rgba(0, 0, 0, 0) 70%);
      top: 22%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation: pulseGlow 4s ease-in-out infinite alternate;
    }

    @keyframes pulseGlow {
      0% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.7; }
      100% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
    }

    .logo-container {
      position: relative;
      width: 140px;
      height: 140px;
      margin-bottom: 24px;
      display: flex;
      justify-content: center;
      align-items: center;
      -webkit-app-region: no-drag;
    }

    .logo-ring {
      position: absolute;
      inset: -8px;
      border-radius: 50%;
      border: 2px solid transparent;
      border-top-color: #3b82f6;
      border-right-color: #8b5cf6;
      animation: spin 3s linear infinite;
    }

    .logo-ring-outer {
      position: absolute;
      inset: -16px;
      border-radius: 50%;
      border: 1px dashed rgba(148, 163, 184, 0.3);
      animation: spinReverse 12s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    @keyframes spinReverse {
      100% { transform: rotate(-360deg); }
    }

    .logo-img-box {
      width: 120px;
      height: 120px;
      border-radius: 28px;
      background: rgba(30, 41, 59, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 16px;
      animation: float 3.5s ease-in-out infinite;
      overflow: hidden;
    }

    .logo-img-box img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.35));
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }

    .title {
      font-size: 21px;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.4;
      margin-bottom: 8px;
      text-align: center;
      letter-spacing: -0.2px;
      background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 30px;
      text-align: center;
      font-weight: 400;
      line-height: 1.5;
    }

    .progress-box {
      width: 100%;
      max-width: 320px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }

    .progress-track {
      width: 100%;
      height: 6px;
      background: rgba(30, 41, 59, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      overflow: hidden;
      position: relative;
    }

    .progress-bar {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 40%;
      background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
      border-radius: 999px;
      animation: indeterminate 1.8s ease-in-out infinite;
      box-shadow: 0 0 14px rgba(59, 130, 246, 0.85);
    }

    @keyframes indeterminate {
      0% { right: -40%; width: 30%; }
      50% { width: 60%; }
      100% { right: 110%; width: 30%; }
    }

    .status-text {
      font-size: 12.5px;
      color: #94a3b8;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      background-color: #3b82f6;
      border-radius: 50%;
      box-shadow: 0 0 8px #3b82f6;
      animation: blink 1.2s infinite ease-in-out alternate;
    }

    @keyframes blink {
      0% { opacity: 0.3; transform: scale(0.8); }
      100% { opacity: 1; transform: scale(1.2); }
    }
  </style>
</head>
<body>
  <div class="splash-card">
    <div class="bg-glow"></div>

    <div class="logo-container">
      <div class="logo-ring-outer"></div>
      <div class="logo-ring"></div>
      <div class="logo-img-box">
        <img src="public/logo.png" alt="Logo" onerror="this.src='logo.png'" />
      </div>
    </div>

    <h1 class="title">سامانه مدیریت مانور دپو</h1>
    <p class="subtitle">پایانه فتح‌آباد (خط ۱ متروی تهران)</p>

    <div class="progress-box">
      <div class="progress-track">
        <div class="progress-bar"></div>
      </div>
      <div class="status-text">
        <span class="status-dot"></span>
        <span>در حال راه‌اندازی و اتصال به پایگاه داده...</span>
      </div>
    </div>
  </div>
</body>
</html>
`;

fs.writeFileSync(path.join(rootDir, 'splash.html'), htmlContent, 'utf8');
console.log('Successfully generated splash.html with embedded Vazirmatn fonts. Size:', fs.statSync(path.join(rootDir, 'splash.html')).size);
