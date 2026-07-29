import { isRoleAllowedToManage } from "@/lib/perms";

export interface ManageableTarget {
  id: number;
  role: number;
}

/**
 * شناسه‌هایی را برمی‌گرداند که اقدام‌کننده مجاز به مدیریت آنها نیست
 * (هم‌سطح یا بالاتر از خودش).
 */
export function findUnmanageableIds(
  actorRole: number,
  targets: ManageableTarget[]
): number[] {
  return targets
    .filter((t) => !isRoleAllowedToManage(actorRole, t.role))
    .map((t) => t.id);
}

/**
 * شناسه‌هایی که در درخواست بودند اما در دیتابیس یافت نشدند.
 */
export function findMissingIds(
  requestedIds: number[],
  found: ManageableTarget[]
): number[] {
  const foundSet = new Set(found.map((t) => t.id));
  return requestedIds.filter((id) => !foundSet.has(id));
}
