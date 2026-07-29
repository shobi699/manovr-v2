declare module "pdfmake/js/Printer" {
  export default class PdfPrinter {
    constructor(fonts: Record<string, any>);
    createPdfKitDocument(docDefinition: any, options?: any): any;
  }
}

declare module "arabic-persian-reshaper" {
  export class PersianShaper {
    static convertArabic(text: string): string;
  }
}
