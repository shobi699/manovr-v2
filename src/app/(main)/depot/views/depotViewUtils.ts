import { LineData, TrainData, ActiveManovrData, TerminalData } from "../types";

export interface Depot2DViewProps {
  lines: LineData[];
  trains: TrainData[];
  activeManovrs?: ActiveManovrData[];
  terminals: TerminalData[];
  columnsData?: Record<number, any[]>;
  canCreateManovr: boolean;
  canManageLines: boolean;
  canLayout: boolean;
  isFocusMode: boolean;
  theme?: string;
  zoom?: number;
  onSelectLine: (line: LineData) => void;
  onSelectTrain: (train: TrainData) => void;
  onDropTrainToLine: (trainId: number, targetLine: LineData, slotIdx?: number) => void;
  onSelectEmptySlot?: (srcLineId: number | null, dstLineId: number, slotIdx: number) => void;
}

export function getPersianLineTitle(line: LineData): string {
  let text = line.name || line.tag || "";
  text = text
    .replace(/^Dizel_Factory(\d+)/i, "کارخانه $1")
    .replace(/^Dizel_B(\d+)/i, "دیزل شاپ B$1")
    .replace(/^Dizel_(\d+)/i, "دیزل شاپ $1")
    .replace(/^Dizel_TestLine/i, "خط تست دیزل")
    .replace(/^Dizel_Battery/i, "باطری‌خانه")
    .replace(/^Wagon_CoorLine(\d+)/i, "رابط واگن‌سازی $1")
    .replace(/^Wagon_(\d+)/i, "واگن‌سازی $1")
    .replace(/^Alt_CoorLine(\d+)/i, "خط رابط $1")
    .replace(/^Alt_Abgiri/i, "آبگیری")
    .replace(/^Alt_DavarShargi/i, "دوّار شرقی")
    .replace(/^Alt_DavarGarbi/i, "دوّار غربی")
    .replace(/^Alt_Pitline/i, "پیت‌لاین")
    .replace(/^Alt_MetroWash/i, "قطارشویی")
    .replace(/^Alt_MojaverSole/i, "مجاور سوله")
    .replace(/^Alt_MojaverMarkaz/i, "مجاور مرکز")
    .replace(/^khat-aliabad/i, "خط علی‌آباد")
    .replace(/^khat(\d+)/i, "خط $1")
    .replace(/^S_OriginalLine/i, "خط اصلی")
    .replace(/^slole-sharghi/i, "سوله شرقی")
    .replace(/^slole-gharbi/i, "سوله غربی");
  return text.replace(/\d+/g, (d) => Number(d).toLocaleString("fa-IR", { useGrouping: false }));
}
