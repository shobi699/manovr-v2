export interface LineData {
  id: number;
  name: string;
  tag: string | null;
  capacity: number;
  terminal: number;
  isDynamic: boolean;
  posX: number;
  posY: number;
  rotation: number;
  length: number;
  isActive?: boolean;
}

export interface TrainData {
  id: number;
  code: string;
  type: number;
  isDisposed: boolean;
  lineId: number | null;
  slotIndex: number;
  status: number;
  hasKafshak?: boolean;
  noAtp?: boolean;
  movadDavvar?: string | null;
  noLicense?: boolean;
}

export interface ActiveManovrData {
  id: number;
  trainId: number | null;
  destinationLineId: number | null;
}

export interface RahbarData {
  id: number;
  name: string;
}

export interface TerminalData {
  id: number;
  code: number;
  label: string;
  color: string | null;
  meta: string;
}

export interface ManovrTypeLookupItem {
  code: number;
  label: string;
  color?: string | null;
  isActive?: boolean;
}

export interface DepotScenePrefs {
  quality: string;
  refreshSec: number;
  defaultTerminal: number;
  view2DMode?: "grid" | "structured" | "map";
}

export interface DepotSceneProps {
  lines: LineData[];
  initialTrains: TrainData[];
  activeManovrs: ActiveManovrData[];
  rahbaran: RahbarData[];
  terminals: TerminalData[];
  manovrTypes?: ManovrTypeLookupItem[];
  canLayout: boolean;
  canCreateManovr: boolean;
  canManageLines: boolean;
  canEditKafshak?: boolean;
  canEditAtp?: boolean;
  canEditRotary?: boolean;
  canEditLicense?: boolean;
  prefs: DepotScenePrefs;
}

export type ZoneMap = Record<
  number,
  {
    x: number;
    z: number;
    label: string;
    color: string;
    gridCol: number;
    gridRow: "top" | "bottom" | "full";
  }
>;
