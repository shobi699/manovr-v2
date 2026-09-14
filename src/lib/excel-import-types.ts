export interface ImportPersonnelRow {
  rowIndex: number; // شماره سطر در اکسل (1-indexed)
  firstName: string;
  lastName: string;
  personnelCode?: string | null;
  userName?: string | null;
  phone1?: string | null;
  phone2?: string | null;
  internalTel?: string | null;
  address?: string | null;
  shift?: number | null;
  orgPosition?: number | null;
}

export interface ExistingPersonnelSummary {
  id: number;
  firstName: string;
  lastName: string;
  personnelCode: string | null;
  userName: string | null;
  phone1: string | null;
  phone2: string | null;
  internalTel: string | null;
  address: string | null;
  shift: number;
  orgPosition: number;
  hasAccount: boolean;
  role: number;
  accessRoleId: number | null;
}

export type ConflictMatchType = "userName" | "personnelCode" | "phone" | "inFileDuplicate";

export interface ImportConflictItem {
  id: string; // شناسه یکتا برای رندر در لیست
  rowIndex: number;
  matchType: ConflictMatchType;
  matchFieldLabel: string;
  matchValue: string;
  conflictReason: string;
  existingRecord: ExistingPersonnelSummary;
  newRecord: ImportPersonnelRow;
  action: "update" | "skip";
}

export interface PreValidationResult {
  ok: boolean;
  error?: string;
  totalRows: number;
  nonConflicting: ImportPersonnelRow[];
  conflicts: ImportConflictItem[];
}

export interface ImportResolutionItem {
  rowIndex: number;
  existingId: number;
  action: "update" | "skip";
  data: ImportPersonnelRow;
}

export interface BatchImportPayload {
  newRecords: ImportPersonnelRow[];
  resolutions: ImportResolutionItem[];
}

export interface ImportSummaryReport {
  ok: boolean;
  error?: string;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  totalProcessed: number;
  message: string;
}
