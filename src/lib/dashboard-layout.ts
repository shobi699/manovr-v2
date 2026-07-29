export const LAYOUT_SCOPES = ["user", "role", "default"] as const;
export type LayoutScope = (typeof LAYOUT_SCOPES)[number];

export function isValidLayoutScope(scope: unknown): scope is LayoutScope {
  return typeof scope === "string" && (LAYOUT_SCOPES as readonly string[]).includes(scope);
}

export function isSharedLayoutScope(scope: LayoutScope): boolean {
  return scope !== "user";
}
