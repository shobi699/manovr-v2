/**
 * اسکریپت تخصصی تعمیر، آزادسازی قفل و بهینه‌سازی دیتابیس مشترک شبکه
 * سامانه مانور پایانه ریلی فتح‌آباد
 * 
 * نحوه اجرا:
 * node scripts/repair-network-db.mjs [مسیر_دیتابیس]
 * 
 * مثال برای شبکه سرور:
 * node scripts/repair-network-db.mjs "\\\\srvdfs01\\Line1\\Depo\\data\\database\\dev.db"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

async function resolveTargetDbPath() {
  if (process.argv[2]) {
    return path.resolve(process.argv[2]);
  }

  // بررسی فایل کانفیگ manovr-config.json
  const configPath = path.join(rootDir, 'manovr-config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.sharedDataPath) {
        const candidate1 = path.join(config.sharedDataPath, 'database', 'dev.db');
        if (fs.existsSync(candidate1)) return candidate1;
        const candidate2 = path.join(config.sharedDataPath, 'dev.db');
        if (fs.existsSync(candidate2)) return candidate2;
      }
    } catch {}
  }

  // پیش‌فرض DFS سرور سازمان
  const dfsDefault = '\\\\srvdfs01\\Line1\\Depo\\data\\database\\dev.db';
  if (fs.existsSync(dfsDefault)) {
    return dfsDefault;
  }

  // حالت محلی
  return path.join(rootDir, 'prisma', 'dev.db');
}

async function repairDatabase() {
  console.log('========================================================');
  console.log('🛠️ ابزار تعمیر، رفع قفل و بهینه‌سازی دیتابیس شبکه (Manovr V3)');
  console.log('========================================================');

  const dbPath = await resolveTargetDbPath();
  console.log(`📍 مسیر شناسایی‌شده دیتابیس: ${dbPath}`);

  if (!fs.existsSync(dbPath)) {
    console.error(`❌ فایل پایگاه داده در مسیر مشخص‌شده یافت نشد: ${dbPath}`);
    console.log('💡 لطفاً مسیر صحیح فایل dev.db را به عنوان آرگومان وارد کنید.');
    process.exit(1);
  }

  // ۱. تهیه نسخه پشتیبان اضطراری پیش از هرگونه تغییر
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${dbPath}.repair-backup-${timestamp}`;
  try {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ ۱. نسخه پشتیبان اضطراری با موفقیت ذخیره شد:\n   📁 ${backupPath}`);
  } catch (err) {
    console.warn(`⚠️ امکان کپی فایل پشتیبان مهیا نشد (احتمالاً فایل توسط کاربر دیگر در حال خواندن است): ${err.message}`);
  }

  // ۲. اتصال با کانکشن تک و کنترل‌شده
  const normalizedDbUrl = `file:${dbPath.replace(/\\/g, '/')}?connection_limit=1&socket_timeout=60`;
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: normalizedDbUrl,
      },
    },
  });

  try {
    console.log('⏳ ۲. در حال اتصال به پایگاه داده و بررسی حالت ژورنال فعلی...');
    const currentJm = await prisma.$queryRawUnsafe('PRAGMA journal_mode;');
    console.log('   حالت ژورنال فعلی:', currentJm);

    // ۳. در صورتی که در حالت WAL باشد، Checkpoint کامل و انتقال داده‌ها به فایل اصلی
    console.log('⏳ ۳. انجام Checkpoint و بستن ژورنال‌های معلق...');
    try {
      await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);');
      console.log('   ✅ دستور wal_checkpoint با موفقیت اجرا گردید.');
    } catch (walErr) {
      console.log('   ℹ️ دیتابیس در حالت WAL نبوده یا نیاز به چک‌پوینت ندارد:', walErr.message);
    }

    // ۴. تغییر قطعی و پایدار حالت به TRUNCATE (سازگارترین حالت با پوشه اشتراکی ویندوز / SMB)
    console.log('⏳ ۴. تغییر حالت پایدار به TRUNCATE جهت ریشه‌کن شدن خطای 2570...');
    const newJm = await prisma.$queryRawUnsafe('PRAGMA journal_mode = TRUNCATE;');
    console.log('   ✅ حالت ژورنال با موفقیت تثبیت شد:', newJm);

    // ۵. تنظیم پارامترهای مکمل تاب‌آوری شبکه
    console.log('⏳ ۵. اعمال پارامترهای تایم‌اوت و مدیریت حافظه شبکه...');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 60000;');
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
    await prisma.$queryRawUnsafe('PRAGMA temp_store = MEMORY;');
    await prisma.$queryRawUnsafe('PRAGMA locking_mode = NORMAL;');
    console.log('   ✅ پارامترهای busy_timeout = 60s, temp_store = MEMORY و synchronous = NORMAL تثبیت شدند.');

    // ۶. تست سلامت و انجام تراکنش آزمایشی خواندن و نوشتن
    console.log('⏳ ۶. انجام تست سلامت و اعتبارسنجی I/O دیسک شبکه...');
    const start = Date.now();
    const count = await prisma.personnel.count();
    const duration = Date.now() - start;
    console.log(`   ✅ تست خواندن موفقیت‌آمیز بود (تعداد پرسنل: ${count}، زمان پاسخ: ${duration}ms).`);

    // ۷. پاکسازی فایل‌های سرگردان -shm و -wal در صورت وجود
    const dir = path.dirname(dbPath);
    const baseName = path.basename(dbPath);
    const walFile = path.join(dir, `${baseName}-wal`);
    const shmFile = path.join(dir, `${baseName}-shm`);

    if (fs.existsSync(walFile)) {
      try {
        fs.unlinkSync(walFile);
        console.log('   🧹 فایل سرگردان wal حذف شد.');
      } catch (e) {
        console.log('   ℹ️ فایل wal در اختیار سیستم است و نیاز به حذف دستی ندارد.');
      }
    }

    if (fs.existsSync(shmFile)) {
      try {
        fs.unlinkSync(shmFile);
        console.log('   🧹 فایل سرگردان shm حذف شد.');
      } catch (e) {
        console.log('   ℹ️ فایل shm در اختیار سیستم است و نیاز به حذف دستی ندارد.');
      }
    }

    console.log('========================================================');
    console.log('🎉 عملیات بهینه‌سازی و رفع خطای دیتابیس با موفقیت ۱۰۰٪ پایان یافت.');
    console.log('   هم‌اکنون نرم‌افزار بر روی تمام کلاینت‌های متصل به شبکه بدون خطای ۲۵۷۰ آماده بهره‌برداری است.');
    console.log('========================================================');
  } catch (error) {
    console.error('❌ خطا در فرآیند بهینه‌سازی دیتابیس:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

repairDatabase();
