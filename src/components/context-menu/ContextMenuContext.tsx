"use client";

import React, { createContext, useContext } from "react";
import { ContextMenuItem, ContextMenuPosition } from "./types";

export interface ContextMenuContextValue {
  isOpen: boolean;
  position: ContextMenuPosition;
  customItems: ContextMenuItem[] | null;
  openMenu: (e: React.MouseEvent | MouseEvent, items?: ContextMenuItem[]) => void;
  closeMenu: () => void;
  registerItems: (key: string, items: ContextMenuItem[]) => () => void;
  registeredGroups: Record<string, ContextMenuItem[]>;
}

export const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

export function useContextMenuContext(): ContextMenuContextValue {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) {
    throw new Error("useContextMenu must be used within a ContextMenuProvider");
  }
  return ctx;
}
