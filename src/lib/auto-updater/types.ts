import { z } from "zod";

/**
 * ساختار اعتبارسنجی مانیفست نسخه در پوشه اشتراکی شبکه (version.json)
 */
export const updateChangelogSchema = z.object({
  highlights: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  fixes: z.array(z.string()).default([]),
  breaking: z.array(z.string()).optional(),
});

export const updateManifestSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/, "فرمت شماره نسخه باید مطابق SemVer باشد"),
  releaseDate: z.string(),
  releaseDateJalali: z.string(),
  minSupportedVersion: z.string(),
  packageType: z.enum(["patch", "full"]),
  packageFile: z.string(),
  sha256: z.string().length(64, "هش SHA-256 باید دقیقا ۶۴ کاراکتر هگزادسیمال باشد"),
  fileSizeBytes: z.number().int().positive(),
  mandatory: z.boolean().default(false),
  changelog: updateChangelogSchema,
  targetPlatform: z.literal("win-x64").default("win-x64"),
});

export type UpdateManifest = z.infer<typeof updateManifestSchema>;
export type UpdateChangelog = z.infer<typeof updateChangelogSchema>;

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "up_to_date"
  | "downloading"
  | "verifying"
  | "ready_to_install"
  | "installing"
  | "error";

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  manifest?: UpdateManifest;
  manifestPath?: string;
  error?: string;
}

export interface UpdateProgress {
  status: UpdateStatus;
  percentage: number;
  transferredBytes: number;
  totalBytes: number;
  message: string;
  error?: string;
}
