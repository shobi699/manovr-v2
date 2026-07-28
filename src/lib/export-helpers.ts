import ExcelJS from "exceljs";
// @ts-ignore
import PdfPrinter from "pdfmake/js/Printer";
import path from "path";
// @ts-ignore
import { PersianShaper } from "arabic-persian-reshaper";
import { ManovrType, ManovrStatus, ConfirmationStatus, TrainType, Terminal, Shift, OrgPosition, PersonnelType, Role } from "@/lib/enums";

// شبیه‌ساز فونت و چینش راست‌چین فارسی در PDF
function isPersianChar(char: string) {
  const code = char.charCodeAt(0);
  return (
    (code >= 0x0600 && code <= 0x06ff) ||
    (code >= 0xfb50 && code <= 0xfdff) ||
    (code >= 0xfe70 && code <= 0xfeff)
  );
}

export function farsi(text: string): string {
  if (!text) return "";
  const shaped = PersianShaper.convertArabic(text);
  const words = shaped.split(" ");
  const processed = words.map((w: string) =>
    w.split("").some(isPersianChar) ? w.split("").reverse().join("") : w
  );
  return processed.reverse().join(" ");
}

export function getVal(entity: string, item: any, col: string, lookups?: Record<string, any[]>) {
  const lookupVal = (key: string, code: number) => {
    const list = lookups?.[key];
    if (list && Array.isArray(list)) {
      const found = list.find((v: any) => v.code === code);
      if (found) return found.label;
    }
    return null;
  };

  if (entity === "manovr") {
    if (col === "type") return lookupVal("manovr_type", item.type) ?? ManovrType[item.type] ?? String(item.type);
    if (col === "status") return lookupVal("manovr_status", item.status) ?? ManovrStatus[item.status] ?? String(item.status);
    if (col === "confirmationStatus") return lookupVal("confirmation_status", item.confirmationStatus) ?? ConfirmationStatus[item.confirmationStatus] ?? String(item.confirmationStatus);
    if (col === "sourceLine") return item.sourceLine?.name ?? "—";
    if (col === "destinationLine") return item.destinationLine?.name ?? "—";
    if (col === "train") return item.train?.code ?? "—";
    if (col === "rahbar1") return item.rahbar1 ? `${item.rahbar1.firstName} ${item.rahbar1.lastName}`.trim() : "—";
    if (col === "rahbar2") return item.rahbar2 ? `${item.rahbar2.firstName} ${item.rahbar2.lastName}`.trim() : "—";
    if (col === "creator") return item.creator ? `${item.creator.firstName} ${item.creator.lastName}`.trim() : "سیستم";
    if (col === "createdAt") return item.createdAt ? new Date(item.createdAt).toLocaleString("fa-IR", { timeZone: "Asia/Tehran", calendar: "persian" }) : "—";
    if (col === "finishedAt") return item.finishedAt ? new Date(item.finishedAt).toLocaleString("fa-IR", { timeZone: "Asia/Tehran", calendar: "persian" }) : "—";
    if (col === "executionTime") return item.executionTime ? new Date(item.executionTime).toLocaleString("fa-IR", { timeZone: "Asia/Tehran", calendar: "persian" }) : "—";
  }
  if (entity === "train") {
    if (col === "type") return lookupVal("train_type", item.type) ?? TrainType[item.type] ?? String(item.type);
    if (col === "line") return item.line?.name ?? "—";
    if (col === "isDisposed") return item.isDisposed ? "غیرفعال" : "فعال";
  }
  if (entity === "line") {
    if (col === "terminal") return lookupVal("terminal", item.terminal) ?? Terminal[item.terminal] ?? String(item.terminal);
    if (col === "isDynamic") return item.isDynamic ? "دینامیک" : "ثابت";
  }
  if (entity === "personnel") {
    if (col === "shift") return lookupVal("shift", item.shift) ?? Shift[item.shift] ?? String(item.shift);
    if (col === "orgPosition") return lookupVal("org_position", item.orgPosition) ?? OrgPosition[item.orgPosition] ?? String(item.orgPosition);
    if (col === "role") return lookupVal("role", item.role) ?? Role[item.role] ?? String(item.role);
    if (col === "personnelType") return PersonnelType[item.personnelType] ?? String(item.personnelType);
  }
  return item[col] ? String(item[col]) : "—";
}

export const FIELD_LABELS: Record<string, string> = {
  id: "شناسه مانور",
  type: "نوع مانور",
  status: "وضعیت اجرا",
  confirmationStatus: "تأییدیه",
  sourceLine: "خط مبدأ",
  destinationLine: "خط مقصد",
  train: "قطار",
  rahbar1: "راهبر ۱",
  rahbar2: "راهبر ۲",
  creator: "کاربر ثبت‌کننده",
  createdAt: "زمان ثبت",
  finishedAt: "زمان اتمام",
  executionTime: "زمان اجرای واقعی",
  description: "توضیحات",
  code: "کد قطار",
  line: "خط جاری",
  slotIndex: "اسلات پارک",
  isDisposed: "وضعیت",
  name: "نام خط",
  tag: "تگ",
  capacity: "ظرفیت",
  terminal: "ترمینال",
  isDynamic: "نوع خط",
  posX: "موقعیت X",
  posY: "موقعیت Y",
  rotation: "چرخش",
  length: "طول ریل",
  firstName: "نام",
  lastName: "نام خانوادگی",
  userName: "نام کاربری",
  phone1: "همراه ۱",
  phone2: "همراه ۲",
  internalTel: "داخلی",
  address: "آدرس",
  shift: "شیفت",
  orgPosition: "سمت",
  personnelType: "نوع پرسنل",
  personnelCode: "کد پرسنلی",
};

// تولید فایل Excel راست‌چین به عنوان بافر
export async function generateExcelBuffer(entity: string, fields: string[], records: any[], lookups?: Record<string, any[]>): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("گزارش پایانه");

  worksheet.views = [{ rtl: true } as any];

  const columns = fields.map((field) => ({
    header: FIELD_LABELS[field] || field,
    key: field,
    width: 20,
  }));
  worksheet.columns = columns;

  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F3A5F" },
    };
    cell.font = {
      name: "Tahoma",
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 11,
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FFD8842A" } },
    };
  });

  records.forEach((record, index) => {
    const rowData = fields.map((field) => getVal(entity, record, field, lookups));
    const addedRow = worksheet.addRow(rowData);
    addedRow.height = 22;

    const isEven = index % 2 === 0;
    addedRow.eachCell((cell) => {
      cell.font = { name: "Tahoma", size: 10 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
      };
      if (isEven) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

// تولید فایل PDF فارسی و راست‌چین به عنوان بافر
export async function generatePDFBuffer(entity: string, fields: string[], records: any[], lookups?: Record<string, any[]>): Promise<Uint8Array> {
  const fonts = {
    Vazirmatn: {
      normal: path.join(process.cwd(), "public/fonts/Vazirmatn-Regular.ttf"),
      bold: path.join(process.cwd(), "public/fonts/Vazirmatn-Bold.ttf"),
    },
  };

  const printer = new (PdfPrinter as any)(fonts);
  const reversedFields = [...fields].reverse();

  const headerRow = reversedFields.map((field) => ({
    text: farsi(FIELD_LABELS[field] || field),
    bold: true,
    alignment: "center",
    fillColor: "#1f3a5f",
    color: "#ffffff",
    fontSize: 9,
    margin: [4, 6, 4, 6],
  }));

  const tableRows = records.map((record, index) => {
    const isEven = index % 2 === 0;
    return reversedFields.map((field) => ({
      text: farsi(getVal(entity, record, field, lookups)),
      alignment: "center",
      fontSize: 8,
      fillColor: isEven ? "#f9fafb" : undefined,
      margin: [4, 4, 4, 4],
    }));
  });

  const entityTitle = entity === "manovr" ? "مانورها" : entity === "train" ? "قطارها" : entity === "line" ? "خطوط" : "پرسنل";

  const docDefinition = {
    content: [
      { text: farsi("سیستم مدیریت مانور پایانه فتح‌آباد"), fontSize: 11, color: "#7b8794", alignment: "center", margin: [0, 0, 0, 4] },
      { text: farsi(`گزارش جامع اطلاعاتی - موجودیت ${entityTitle}`), fontSize: 14, bold: true, alignment: "center", margin: [0, 0, 0, 16] },
      {
        table: {
          headerRows: 1,
          widths: reversedFields.map(() => "*"),
          body: [headerRow, ...tableRows],
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 1 : 0.5),
          vLineWidth: () => 0.5,
          hLineColor: () => "#d9dee4",
          vLineColor: () => "#d9dee4",
        },
      },
      { text: farsi(`تعداد کل رکوردها: ${records.length}`), fontSize: 9, alignment: "right", margin: [0, 12, 0, 0], color: "#48525e" },
    ],
    defaultStyle: {
      font: "Vazirmatn",
    },
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", (err: any) => reject(err));
    pdfDoc.end();
  });

  return new Uint8Array(buffer);
}
