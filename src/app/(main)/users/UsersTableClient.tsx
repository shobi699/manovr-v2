"use client";

import React, { useState, useMemo } from "react";
import DataTable, { BulkAction } from "@/components/DataTable";
import UserRowActions from "./UserRowActions";
import {
  Role,
  OrgPosition,
  Shift,
  PersonnelType,
  ManovrType,
  ManovrStatus,
  ConfirmationStatus,
} from "@/lib/enums";
import {
  importPersonnelFromExcel,
  bulkUpdateUserShift,
  bulkUpdateUserOrgPosition,
  bulkDeleteUsers,
  bulkCreateUserAccounts,
} from "@/app/actions/user";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface LookupValue {
  code: number;
  label: string;
  color?: string | null;
}

interface UsersTableClientProps {
  accounts: any[];
  nonAccounts: any[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  currentUserId: number;
  isShiftSupervisor?: boolean;
  todayManeuvers?: any[];
  orgPositions?: LookupValue[];
  shifts?: LookupValue[];
  roles?: LookupValue[];
}

export default function UsersTableClient({
  accounts,
  nonAccounts,
  canCreate,
  canEdit,
  canDelete,
  currentUserId,
  isShiftSupervisor = false,
  todayManeuvers = [],
  orgPositions = [],
  shifts = [],
  roles = [],
}: UsersTableClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [bulkDeleteTarget, setBulkDeleteTarget] = useState<{ items: any[]; clear: () => void } | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const getOrgPosLabel = (code: number) => orgPositions.find((v) => v.code === code)?.label || OrgPosition[code] || `پست ${code}`;
  const getShiftLabel = (code: number) => shifts.find((v) => v.code === code)?.label || Shift[code] || `شیفت ${code}`;
  const getRoleLabel = (code: number) => roles.find((v) => v.code === code)?.label || Role[code] || `نقش ${code}`;
  const [activeTab, setActiveTab] = useState<"personnel" | "maneuvers">("personnel");

  const [filterShift, setFilterShift] = useState<string>("all");
  const [filterOrgPosition, setFilterOrgPosition] = useState<string>("all");
  const [filterPersonnelType, setFilterPersonnelType] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");

  const handleConfirmBulkDelete = async () => {
    if (!bulkDeleteTarget) return;
    setIsDeletingBulk(true);
    const { items, clear } = bulkDeleteTarget;
    const ids = items.map((i) => i.id);
    const res = await bulkDeleteUsers(ids);
    setIsDeletingBulk(false);
    setBulkDeleteTarget(null);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(`${ids.length} کاربر با موفقیت حذف شدند.`);
      clear();
      router.refresh();
    }
  };

  const userBulkActions: BulkAction<any>[] = useMemo(() => {
    if (!canEdit && !canDelete) return [];

    return [
      {
        key: "shift_1",
        label: "🏢 شیفت ۱ (صبح)",
        onClick: async (items, clear) => {
          const ids = items.map((i) => i.id);
          const res = await bulkUpdateUserShift(ids, 1);
          if (res.error) {
            toast.error(res.error);
          } else {
            toast.success("شیفت پرسنل انتخاب‌شده به شیفت ۱ تغییر یافت.");
            clear();
            router.refresh();
          }
        },
      },
      {
        key: "shift_2",
        label: "🏢 شیفت ۲ (عصر)",
        onClick: async (items, clear) => {
          const ids = items.map((i) => i.id);
          const res = await bulkUpdateUserShift(ids, 2);
          if (res.error) {
            toast.error(res.error);
          } else {
            toast.success("شیفت پرسنل انتخاب‌شده به شیفت ۲ تغییر یافت.");
            clear();
            router.refresh();
          }
        },
      },
      {
        key: "shift_3",
        label: "🏢 شیفت ۳ (شب)",
        onClick: async (items, clear) => {
          const ids = items.map((i) => i.id);
          const res = await bulkUpdateUserShift(ids, 3);
          if (res.error) {
            toast.error(res.error);
          } else {
            toast.success("شیفت پرسنل انتخاب‌شده به شیفت ۳ تغییر یافت.");
            clear();
            router.refresh();
          }
        },
      },
      {
        key: "org_rahbar",
        label: "👥 سمت: راهبر قطار",
        variant: "accent",
        onClick: async (items, clear) => {
          const ids = items.map((i) => i.id);
          const res = await bulkUpdateUserOrgPosition(ids, 1);
          if (res.error) {
            toast.error(res.error);
          } else {
            toast.success("سمت پرسنل انتخاب‌شده به راهبر قطار تغییر یافت.");
            clear();
            router.refresh();
          }
        },
      },
      {
        key: "create_accounts",
        label: "🔑 ساخت حساب کاربری (رمز: ۱۲۳۴۵۶)",
        variant: "accent",
        onClick: async (items, clear) => {
          const ids = items.map((i) => i.id);
          const res = await bulkCreateUserAccounts(ids);
          if (res.error) {
            toast.error(res.error);
          } else {
            toast.success(res.message || `برای ${res.count} پرسنل حساب کاربری با رمز ۱۲۳۴۵۶ فعال شد.`);
            clear();
            router.refresh();
          }
        },
      },
      {
        key: "bulk_delete",
        label: "🗑️ حذف دسته‌جمعی پرسنل",
        variant: "danger",
        onClick: (items, clear) => {
          setBulkDeleteTarget({ items, clear });
        },
      },
    ];
  }, [canEdit, canDelete, router, toast]);

  // استخراج تمام نقش‌های متمایز موجود در حساب‌ها برای نمایش در دراپ‌داون فیلتر
  const uniqueRoles = React.useMemo(() => {
    const rolesMap = new Map<string, string>();
    accounts.forEach((p) => {
      const roleIdStr = String(p.role);
      const roleName = p.accessRole?.name || Role[p.role] || `نقش ${p.role}`;
      rolesMap.set(roleIdStr, roleName);
    });
    return Array.from(rolesMap.entries()).map(([value, label]) => ({ value, label }));
  }, [accounts]);

  // فیلتر کردن حساب‌های کاربری فعال
  const filteredAccounts = React.useMemo(() => {
    return accounts.filter((p) => {
      if (filterShift !== "all" && String(p.shift) !== filterShift) return false;
      if (filterOrgPosition !== "all" && String(p.orgPosition) !== filterOrgPosition) return false;
      if (filterPersonnelType !== "all" && String(p.personnelType) !== filterPersonnelType) return false;
      if (filterRole !== "all" && String(p.role) !== filterRole) return false;
      return true;
    });
  }, [accounts, filterShift, filterOrgPosition, filterPersonnelType, filterRole]);

  // فیلتر کردن پرسنل بدون حساب
  const filteredNonAccounts = React.useMemo(() => {
    return nonAccounts.filter((p) => {
      if (filterShift !== "all" && String(p.shift) !== filterShift) return false;
      if (filterOrgPosition !== "all" && String(p.orgPosition) !== filterOrgPosition) return false;
      if (filterPersonnelType !== "all" && String(p.personnelType) !== filterPersonnelType) return false;
      return true;
    });
  }, [nonAccounts, filterShift, filterOrgPosition, filterPersonnelType]);

  const handleExportExcel = async () => {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("لیست پرسنل");
      worksheet.views = [{ rtl: true } as any];

      worksheet.columns = [
        { header: "نام", key: "firstName", width: 15 },
        { header: "نام خانوادگی", key: "lastName", width: 15 },
        { header: "کد پرسنلی", key: "personnelCode", width: 15 },
        { header: "نام کاربری", key: "userName", width: 15 },
        { header: "شیفت", key: "shift", width: 10 },
        { header: "پست سازمانی", key: "orgPosition", width: 15 },
        { header: "نوع پرسنل", key: "personnelType", width: 15 },
        { header: "همراه ۱", key: "phone1", width: 15 },
        { header: "همراه ۲", key: "phone2", width: 15 },
        { header: "تلفن داخلی", key: "internalTel", width: 12 },
        { header: "آدرس منزل", key: "address", width: 30 },
      ];

      const allData = [...accounts, ...nonAccounts];
      allData.forEach((p) => {
        worksheet.addRow({
          firstName: p.firstName,
          lastName: p.lastName,
          personnelCode: p.personnelCode || "—",
          userName: p.userName || "—",
          shift: getShiftLabel(p.shift),
          orgPosition: getOrgPosLabel(p.orgPosition),
          personnelType: PersonnelType[p.personnelType] || p.personnelType,
          phone1: p.phone1 || "—",
          phone2: p.phone2 || "—",
          internalTel: p.internalTel || "—",
          address: p.address || "—",
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "personnel-list.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error("خطا در خروجی گرفتن اکسل.");
    }
  };

  const handleDownloadSample = async () => {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("نمونه ورود پرسنل");
      worksheet.views = [{ rtl: true } as any];

      worksheet.columns = [
        { header: "نام *", key: "firstName", width: 15 },
        { header: "نام خانوادگی *", key: "lastName", width: 15 },
        { header: "کد پرسنلی (یکتا)", key: "personnelCode", width: 15 },
        { header: "نام کاربری", key: "userName", width: 15 },
        { header: "همراه ۱", key: "phone1", width: 15 },
        { header: "همراه ۲", key: "phone2", width: 15 },
        { header: "داخلی پایانه", key: "internalTel", width: 12 },
        { header: "آدرس منزل", key: "address", width: 30 },
        { header: "شیفت (1=A, 2=B, 3=C)", key: "shift", width: 12 },
        { header: "سمت (1=راهبر، 2=مسئول شیفت، 4=تکنیسین، 5=سایر)", key: "orgPosition", width: 25 },
      ];

      worksheet.addRow({
        firstName: "علی",
        lastName: "رضایی",
        personnelCode: "99101",
        userName: "ali99",
        phone1: "09123456789",
        phone2: "",
        internalTel: "123",
        address: "تهران، میدان آزادی",
        shift: 1,
        orgPosition: 1,
      });

      worksheet.addRow({
        firstName: "حسین",
        lastName: "کریمی",
        personnelCode: "99102",
        userName: "",
        phone1: "09901234567",
        phone2: "",
        internalTel: "124",
        address: "تهران، خیابان ولیعصر",
        shift: 2,
        orgPosition: 4,
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "personnel-sample.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error("خطا در تولید فایل نمونه اکسل.");
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const ExcelJS = (await import("exceljs")).default;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const worksheet = workbook.worksheets[0];

        const rows: any[] = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // skip header
          const vals = Array.isArray(row.values) ? row.values : [];
          
          const firstName = String(vals[1] || "").trim();
          const lastName = String(vals[2] || "").trim();
          if (!firstName || !lastName) return;

          const personnelCode = vals[3] ? String(vals[3]).trim() : undefined;
          const userName = vals[4] ? String(vals[4]).trim() : undefined;
          const phone1 = vals[5] ? String(vals[5]).trim() : undefined;
          const phone2 = vals[6] ? String(vals[6]).trim() : undefined;
          const internalTel = vals[7] ? String(vals[7]).trim() : undefined;
          const address = vals[8] ? String(vals[8]).trim() : undefined;
          const shift = vals[9] ? Number(vals[9]) : undefined;
          const orgPosition = vals[10] ? Number(vals[10]) : undefined;

          rows.push({
            firstName,
            lastName,
            personnelCode,
            userName,
            phone1,
            phone2,
            internalTel,
            address,
            shift,
            orgPosition,
          });
        });

        if (rows.length === 0) {
          toast.warning("هیچ داده معتبری در فایل پیدا نشد.");
          return;
        }

        const res = await importPersonnelFromExcel(rows);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(
            `تعداد ${res.count} پرسنل جدید با موفقیت درج شدند (برای رکوردهای دارای نام کاربری، حساب با رمز ۱۲۳۴۵۶ فعال شد).`
          );
          router.refresh();
        }
      } catch (err) {
        console.error(err);
        toast.error("فرمت فایل اکسل معتبر نیست یا خطا در خواندن رخ داد.");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const rolePill = (r: number) =>
    r === 1 ? "p-crit" : r === 2 ? "p-warn" : r === 3 ? "p-rail" : "p-mut";

  const accountColumns = [
    { key: "userName", label: "نام کاربری", sortable: true, render: (p: any) => <span className="num">{p.userName}</span> },
    { key: "fullName", label: "نام و نام خانوادگی", sortable: true, render: (p: any) => `${p.firstName} ${p.lastName}` },
    { key: "personnelCode", label: "کد پرسنلی", sortable: true, render: (p: any) => <span className="num">{p.personnelCode || "—"}</span> },
    {
      key: "role",
      label: "نقش دسترسی",
      sortable: true,
      render: (p: any) => (
        <span className={`pill ${rolePill(p.role)}`}>
          {p.accessRole?.name || getRoleLabel(p.role)}
        </span>
      ),
    },
    { key: "orgPosition", label: "پست سازمانی", sortable: true, render: (p: any) => getOrgPosLabel(p.orgPosition) },
    { key: "shift", label: "شیفت", sortable: true, render: (p: any) => <span className="num">{getShiftLabel(p.shift)}</span> },
    {
      key: "personnelType",
      label: "نوع پرسنل",
      sortable: true,
      render: (p: any) => (
        <span className="pill p-mut">{PersonnelType[p.personnelType] ?? "—"}</span>
      ),
    },
    ...((canEdit || canDelete)
      ? [
          {
            key: "actions",
            label: "عملیات",
            render: (p: any) => <UserRowActions id={p.id} currentUserId={currentUserId} canEdit={canEdit} canDelete={canDelete} />,
          },
        ]
      : []),
  ];

  const nonAccountColumns = [
    { key: "fullName", label: "نام و نام خانوادگی", sortable: true, render: (p: any) => `${p.firstName} ${p.lastName}` },
    { key: "personnelCode", label: "کد پرسنلی", sortable: true, render: (p: any) => <span className="num">{p.personnelCode || "—"}</span> },
    { key: "orgPosition", label: "پست سازمانی", sortable: true, render: (p: any) => getOrgPosLabel(p.orgPosition) },
    { key: "shift", label: "شیفت", sortable: true, render: (p: any) => <span className="num">{getShiftLabel(p.shift)}</span> },
    {
      key: "personnelType",
      label: "نوع پرسنل",
      sortable: true,
      render: (p: any) => (
        <span className="pill p-mut">{PersonnelType[p.personnelType] ?? "—"}</span>
      ),
    },
    ...((canEdit || canDelete)
      ? [
          {
            key: "actions",
            label: "عملیات",
            render: (p: any) => <UserRowActions id={p.id} currentUserId={currentUserId} canEdit={canEdit} canDelete={canDelete} />,
          },
        ]
      : []),
  ];

  const maneuverColumns = [
    { key: "id", label: "شناسه", sortable: true, render: (m: any) => <span className="num">{m.id}</span> },
    {
      key: "executionTime",
      label: "زمان اجرا",
      sortable: true,
      render: (m: any) => (
        <span className="num" dir="ltr">
          {new Date(m.executionTime || m.createdAt).toLocaleString("fa-IR", {
            timeZone: "Asia/Tehran",
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
      ),
    },
    { key: "type", label: "نوع مانور", sortable: true, render: (m: any) => ManovrType[m.type] || m.type },
    { key: "train", label: "قطار", sortable: true, render: (m: any) => m.train ? <span className="num">{m.train.code}</span> : "—" },
    { key: "sourceLine", label: "خط مبدأ", sortable: true, render: (m: any) => m.sourceLine?.name || "—" },
    { key: "destinationLine", label: "خط مقصد", sortable: true, render: (m: any) => m.destinationLine?.name || "—" },
    { key: "rahbar1", label: "راهبر ۱", sortable: true, render: (m: any) => m.rahbar1 ? `${m.rahbar1.firstName} ${m.rahbar1.lastName}` : "—" },
    { key: "rahbar2", label: "راهبر ۲", sortable: true, render: (m: any) => m.rahbar2 ? `${m.rahbar2.firstName} ${m.rahbar2.lastName}` : "—" },
    {
      key: "status",
      label: "وضعیت",
      sortable: true,
      render: (m: any) => (
        <span className={`pill ${m.status === 2 ? "p-good" : m.status === 3 ? "p-crit" : "p-warn"}`}>
          {ManovrStatus[m.status] || m.status}
        </span>
      ),
    },
    {
      key: "confirmationStatus",
      label: "تأییدیه",
      sortable: true,
      render: (m: any) => (
        <span className={`pill ${m.confirmationStatus === 1 ? "p-good" : m.confirmationStatus === 2 ? "p-crit" : "p-mut"}`}>
          {ConfirmationStatus[m.confirmationStatus] || m.confirmationStatus}
        </span>
      ),
    },
  ];

  return (
    <>
      {isShiftSupervisor && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <button
            onClick={() => setActiveTab("personnel")}
            className={`btn ${activeTab === "personnel" ? "primary" : ""}`}
            style={{ borderRadius: "var(--r-sm)" }}
          >
            پرسنل شیفت
          </button>
          <button
            onClick={() => setActiveTab("maneuvers")}
            className={`btn ${activeTab === "maneuvers" ? "primary" : ""}`}
            style={{ borderRadius: "var(--r-sm)" }}
          >
            مانورهای امروز شیفت ({todayManeuvers.length})
          </button>
        </div>
      )}

      {activeTab === "personnel" ? (
        <>
          {canCreate && (
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={handleExportExcel} className="btn secondary sm">
                📥 خروجی اکسل
              </button>
              <button onClick={handleDownloadSample} className="btn secondary sm">
                📄 نمونه اکسل ورود پرسنل
              </button>
              <label className="btn secondary sm" style={{ cursor: "pointer", margin: 0 }}>
                📤 ورود پرسنل از اکسل
                <input type="file" accept=".xlsx,.xls" onChange={handleExcelImport} style={{ display: "none" }} />
              </label>
            </div>
          )}

          {/* نوار فیلتر پیشرفته */}
          <div className="card" style={{ padding: "16px", marginBottom: "20px", background: "rgba(30, 41, 59, 0.02)", border: "1px solid var(--line-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <span style={{ fontSize: "18px" }}>🔍</span>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "bold", color: "var(--ink)" }}>فیلترهای پیشرفته لیست پرسنل</h3>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", alignItems: "end" }}>
              {/* فیلتر شیفت */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", color: "var(--ink-soft)", fontWeight: 600 }}>شیفت کاری:</label>
                <select
                  value={filterShift}
                  onChange={(e) => setFilterShift(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)", fontSize: "13px" }}
                >
                  <option value="all">همه شیفت‌ها</option>
                  {shifts && shifts.length > 0
                    ? shifts.map((s) => (
                        <option key={s.code} value={String(s.code)}>شیفت {s.label}</option>
                      ))
                    : Object.entries(Shift).map(([val, name]) => (
                        <option key={val} value={val}>شیفت {name}</option>
                      ))
                  }
                </select>
              </div>

              {/* فیلتر سمت سازمانی */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", color: "var(--ink-soft)", fontWeight: 600 }}>سمت سازمانی:</label>
                <select
                  value={filterOrgPosition}
                  onChange={(e) => setFilterOrgPosition(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)", fontSize: "13px" }}
                >
                  <option value="all">همه سمت‌ها</option>
                  {orgPositions && orgPositions.length > 0
                    ? orgPositions.map((o) => (
                        <option key={o.code} value={String(o.code)}>{o.label}</option>
                      ))
                    : Object.entries(OrgPosition).map(([val, name]) => (
                        <option key={val} value={val}>{name}</option>
                      ))
                  }
                </select>
              </div>

              {/* فیلتر نوع پرسنل */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", color: "var(--ink-soft)", fontWeight: 600 }}>نوع پرسنل:</label>
                <select
                  value={filterPersonnelType}
                  onChange={(e) => setFilterPersonnelType(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)", fontSize: "13px" }}
                >
                  <option value="all">همه انواع</option>
                  {Object.entries(PersonnelType).map(([val, name]) => (
                    <option key={val} value={val}>{`پرسنل ${name}`}</option>
                  ))}
                </select>
              </div>

              {/* فیلتر نقش دسترسی */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", color: "var(--ink-soft)", fontWeight: 600 }}>نقش دسترسی سامانه:</label>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)", fontSize: "13px" }}
                >
                  <option value="all">همه نقش‌ها</option>
                  {uniqueRoles.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>

              {/* دکمه ریست */}
              {(filterShift !== "all" || filterOrgPosition !== "all" || filterPersonnelType !== "all" || filterRole !== "all") && (
                <div>
                  <button
                    onClick={() => {
                      setFilterShift("all");
                      setFilterOrgPosition("all");
                      setFilterPersonnelType("all");
                      setFilterRole("all");
                    }}
                    className="btn"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      fontSize: "12px",
                      background: "transparent",
                      border: "1px solid var(--crit-soft)",
                      color: "var(--crit)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px"
                    }}
                  >
                    ❌ پاک کردن فیلترها
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* لیست حساب‌های فعال */}
          <div className="card" style={{ padding: "16px" }}>
            <div className="card-head" style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--line)" }}>
              <h2>حساب‌های کاربری فعال</h2>
              <span className="spacer" />
              <span className="pill p-mut">{filteredAccounts.length} حساب فعال</span>
            </div>
            <div style={{ marginTop: "14px" }}>
              <DataTable
                tableName="user_accounts"
                columns={accountColumns}
                data={filteredAccounts}
                searchPlaceholder="جستجو بر اساس نام کاربری، نام، نام خانوادگی، کد پرسنلی..."
                searchFields={["userName", "firstName", "lastName", "personnelCode"]}
                bulkActions={userBulkActions}
              />
            </div>
          </div>

          {/* لیست پرسنل بدون حساب */}
          <div className="card" style={{ marginTop: 24, padding: "16px" }}>
            <div className="card-head" style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--line)" }}>
              <h2>پرسنل بدون حساب کاربری</h2>
              <span className="spacer" />
              <span className="pill p-mut">{filteredNonAccounts.length} پرسنل بدون حساب</span>
            </div>
            <div style={{ marginTop: "14px" }}>
              <DataTable
                tableName="user_personnel"
                columns={nonAccountColumns}
                data={filteredNonAccounts}
                searchPlaceholder="جستجو بر اساس نام، نام خانوادگی، کد پرسنلی..."
                searchFields={["firstName", "lastName", "personnelCode"]}
                bulkActions={userBulkActions}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: "16px" }}>
          <div className="card-head" style={{ padding: "0 0 12px 0", borderBottom: "1px solid var(--line)" }}>
            <h2>مانورهای ثبت شده امروز شیفت</h2>
            <span className="spacer" />
            <span className="pill p-mut">{todayManeuvers.length} مانور</span>
          </div>
          <div style={{ marginTop: "14px" }}>
            <DataTable
              tableName="shift_today_maneuvers"
              columns={maneuverColumns}
              data={todayManeuvers}
              searchPlaceholder="جستجو بر اساس قطار، نوع مانور..."
              searchFields={["train.code", "type"]}
            />
          </div>
        </div>
      )}

      {/* مدال تایید حذف گروهی */}
      <ConfirmModal
        isOpen={!!bulkDeleteTarget}
        title="تأیید حذف دسته‌جمعی پرسنل"
        message={`آیا از حذف دسته‌جمعی ${bulkDeleteTarget?.items.length || 0} پرسنل انتخاب‌شده مطمئن هستید؟ این عملیات غیرقابل بازگشت است.`}
        confirmText="حذف دسته‌جمعی"
        cancelText="انصراف"
        variant="danger"
        isLoading={isDeletingBulk}
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setBulkDeleteTarget(null)}
      />
    </>
  );
}
