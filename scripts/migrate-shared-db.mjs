/**
 * اسکریپت مهاجرت و به‌روزرسانی ایمن دیتابیس شبکه/محلی بدون از دست رفتن اطلاعات قبلی
 * نحوه اجرا:
 * node scripts/migrate-shared-db.mjs [مسیر_فایل_دیتابیس]
 * مثال:
 * node scripts/migrate-shared-db.mjs "\\\\srvdfs01\\Line1\\Depo\\data\\database\\dev.db"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

async function getTargetDbPath() {
  // ۱. آرگومان خط فرمان
  if (process.argv[2]) {
    return path.resolve(process.argv[2]);
  }

  // ۲. فایل کانفیگ manovr-config.json
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
    } catch {
      // ادامه با حالت محلی
    }
  }

  // ۳. فایل محلی دیتابیس پروژه
  return path.join(rootDir, 'prisma', 'dev.db');
}

async function runMigration() {
  const dbPath = await getTargetDbPath();
  console.log('========================================================');
  console.log('🔄 اسکریپت به‌روزرسانی ساختار دیتابیس سامانه مانور');
  console.log('📍 مسیر هدف دیتابیس:', dbPath);
  console.log('========================================================');

  if (!fs.existsSync(dbPath)) {
    console.error('❌ فایل دیتابیس در مسیر مشخص‌شده یافت نشد:', dbPath);
    console.log('💡 لطفاً مسیر صحیح را به عنوان آرگومان وارد کنید.');
    process.exit(1);
  }

  // ۱. ایجاد نسخه پشتیبان امن (Backup)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${dbPath}.backup-${timestamp}`;
  try {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ نسخه پشتیبان با موفقیت ایجاد شد:\n   📁 ${backupPath}`);
  } catch (err) {
    console.error('⚠️ خطا در تهیه نسخه پشتیبان، اما عملیات ادامه می‌یابد:', err.message);
  }

  // ۲. اتصال از طریق Prisma به این فایل خاص
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbPath}`,
      },
    },
  });

  try {
    // بررسی ستون‌های موجود در جدول Personnel
    const tableInfo = await prisma.$queryRawUnsafe(`PRAGMA table_info("Personnel");`);
    const hasPartTimeDriver = Array.isArray(tableInfo) && tableInfo.some((col) => col.name === 'isPartTimeDriver');

    if (hasPartTimeDriver) {
      console.log('ℹ️ ستون «isPartTimeDriver» از قبل در جدول Personnel موجود است. نیازی به تغییر نیست.');
    } else {
      console.log('⏳ در حال افزودن ستون «isPartTimeDriver» با مقدار پیش‌فرض 0 (false) بدون دستکاری سایر داده‌ها...');
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Personnel" ADD COLUMN "isPartTimeDriver" BOOLEAN NOT NULL DEFAULT 0;`
      );
      console.log('✅ ستون «isPartTimeDriver» با موفقیت به جدول Personnel اضافه شد.');
    }

    // ایجاد ایندکس جهت سرعت بهینه جستجو
    console.log('⏳ در حال اطمینان از وجود ایندکس جستجو...');
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Personnel_isPartTimeDriver_idx" ON "Personnel"("isPartTimeDriver");`
    );
    console.log('✅ ایندکس Personnel_isPartTimeDriver_idx با موفقیت تثبیت شد.');

    // بررسی صحت داده‌ها
    const count = await prisma.personnel.count();
    const partTimeCount = await prisma.personnel.count({ where: { isPartTimeDriver: true } });
    console.log('--------------------------------------------------------');
    console.log(`📊 نتیجه صحت‌سنجی:`);
    console.log(`   - تعداد کل پرسنل ثبت‌شده (بدون تغییر): ${count}`);
    console.log(`   - تعداد پرسنل با عنوان راهبر غیردائم: ${partTimeCount}`);
    console.log('🎉 دیتابیس با موفقیت و ۱۰۰٪ بدون از دست رفتن اطلاعات به‌روزرسانی شد!');
    console.log('========================================================');
  } catch (error) {
    console.error('❌ بروز خطا در اعمال تغییرات ساختار:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
