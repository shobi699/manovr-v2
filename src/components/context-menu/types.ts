import React from "react";

export type ContextMenuBadgeVariant = "default" | "warn" | "accent" | "good" | "crit" | "blue";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  badge?: string;
  badgeVariant?: ContextMenuBadgeVariant;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  separatorAfter?: boolean;
  description?: string;
}

export interface ContextMenuGroup {
  id: string;
  title?: string;
  icon?: React.ReactNode;
  items: ContextMenuItem[];
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}
