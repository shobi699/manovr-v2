/**
 * Comprehensive Quality Assurance and Menu Evaluation Types
 * Generated for 002-full-app-qa-audit
 */

export type AuditStatus = "PASS" | "WARN" | "FAIL" | "SKIP";

export interface MenuAuditItem {
  id: string;                      // Unique menu identifier (e.g., "depot", "dashboard")
  title: string;                   // Persian title (e.g., "نمای پایانه")
  route: string;                   // App route (e.g., "/depot")
  requiredPerm?: string;           // Required permission key in perms.ts
  
  // 1. UI & Aesthetics Audit
  uiAudit: {
    status: AuditStatus;
    rtlCompliant: boolean;         // dir="rtl" and logical classes ms/me
    vazirmatnTypography: boolean;  // Vazirmatn font and Persian numerals
    interactiveFeedback: boolean;  // Hover, active, focus, disabled states
    noVisualOverlap: boolean;      // Clean layout with no broken containers
    details?: string;
  };

  // 2. Backend & Logic Audit
  backendAudit: {
    status: AuditStatus;
    actionTested: string;          // Tested server actions
    zodValidationActive: boolean;  // Input validation with Zod
    errorHandlingRobust: boolean;  // Defensive catch without unhandled 500
    permissionGuarded: boolean;    // Guarded by hasPerm
    details?: string;
  };

  // 3. Database Connectivity & Persistence Audit
  dbAudit: {
    status: AuditStatus;
    connectivityVerified: boolean; // Prisma client active
    persistenceProven: boolean;    // DB write & read verified (Persistence Proof)
    walModeActive: boolean;        // SQLite WAL concurrency
    details?: string;
  };

  // 4. Lightness & Performance Audit
  performanceAudit: {
    status: AuditStatus;
    loadTimeMs: number;            // Page load latency in ms
    renderLatencyMs: number;       // Table and component render latency in ms
    resourceLightness: "EXCELLENT" | "GOOD" | "MODERATE" | "HEAVY";
    details?: string;
  };

  overallStatus: AuditStatus;
  notes?: string;
}

export interface SystemLayerCheck {
  layerName: "UI_PRESENTATION" | "SERVER_ACTIONS" | "DATABASE_PERSISTENCE" | "SECURITY_PERMS" | "EXPORT_SERVICES";
  descriptionFa: string;
  status: AuditStatus;
  componentsEvaluated: string[];
  assertionsChecked: number;
  assertionsPassed: number;
  findings: string[];
}

export interface ComprehensiveReport {
  reportId: string;                // Format: QA-YYYYMMDD-###
  reportDateJalali: string;        // Tehran timezone + Persian Jalali calendar
  auditorRole: string;             // QA Specialist
  targetEnvironment: string;       // Local Runtime / Dev Server
  
  summary: {
    totalMenusAudited: number;     // Exactly 20 menus
    passedMenus: number;
    warningMenus: number;
    failedMenus: number;
    averageLoadTimeMs: number;
    systemLightnessRating: "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "POOR";
  };

  menuDetails: MenuAuditItem[];
  layerDetails: SystemLayerCheck[];
  diagnosticObservations: string[];
  recommendations: string[];
  finalVerdict: "SYSTEM_APPROVED" | "ACTION_REQUIRED" | "CRITICAL_DEFECTS";
}
