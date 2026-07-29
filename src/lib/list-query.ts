export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const MAX_PAGE_SIZE = 100;

export interface ListParams {
  page: number; // 1-based
  pageSize: number;
  search: string;
  sortField: string | null;
  sortDir: "asc" | "desc";
}

/**
 * پارامترهای صفحه‌بندی را از searchParams می‌خواند و به مقادیر امن محدود می‌کند.
 * هر ورودی نامعتبر به مقدار پیش‌فرض برمی‌گردد — هیچ‌گاه throw نمی‌کند.
 */
export function parseListParams(
  raw: Record<string, string | string[] | undefined>,
  allowedSortFields: readonly string[]
): ListParams {
  const getSingle = (val: string | string[] | undefined): string => {
    if (Array.isArray(val)) return val[0] ?? "";
    return val ?? "";
  };

  // page
  const pageStr = getSingle(raw.page);
  let page = parseInt(pageStr, 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  // pageSize
  const pageSizeStr = getSingle(raw.pageSize);
  let pageSize = parseInt(pageSizeStr, 10);
  if (isNaN(pageSize) || !(PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSize)) {
    pageSize = DEFAULT_PAGE_SIZE;
  }
  if (pageSize > MAX_PAGE_SIZE) {
    pageSize = MAX_PAGE_SIZE;
  }

  // search
  const search = getSingle(raw.search).trim();

  // sortField
  const sortRaw = getSingle(raw.sort);
  const sortField = allowedSortFields.includes(sortRaw) ? sortRaw : null;

  // sortDir
  const dirRaw = getSingle(raw.dir).toLowerCase();
  const sortDir: "asc" | "desc" = dirRaw === "asc" ? "asc" : "desc";

  return {
    page,
    pageSize,
    search,
    sortField,
    sortDir,
  };
}

/** تبدیل شماره صفحه به skip/take برای Prisma */
export function toPrismaPage(params: ListParams): { skip: number; take: number } {
  return {
    skip: (params.page - 1) * params.pageSize,
    take: params.pageSize,
  };
}

/** تعداد کل صفحات — همیشه حداقل ۱ */
export function totalPageCount(totalRows: number, pageSize: number): number {
  if (totalRows <= 0) return 1;
  return Math.ceil(totalRows / pageSize);
}
