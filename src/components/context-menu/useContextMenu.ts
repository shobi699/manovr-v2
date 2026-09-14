"use client";

import React, { useEffect } from "react";
import { useContextMenuContext } from "./ContextMenuContext";
import { ContextMenuItem } from "./types";

export function useContextMenu() {
  return useContextMenuContext();
}

/**
 * هوک ثبت خودکار ابزارهای اختصاصی صفحه در منوی کلیک‌راست
 * با خروج از صفحه یا unmount شدن کامپوننت، ابزارها به طور خودکار پاکسازی می‌شوند
 */
export function useRegisterContextMenu(
  key: string,
  items: ContextMenuItem[],
  deps: React.DependencyList = []
) {
  const { registerItems } = useContextMenuContext();

  useEffect(() => {
    const unregister = registerItems(key, items);
    return () => {
      unregister();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, registerItems, ...deps]);
}
