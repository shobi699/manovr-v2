import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { redirect, notFound } from "next/navigation";
import { getCachedLookup } from "@/lib/lookups";
import EditUserForm from "./EditUserForm";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const [currentUser, user, roles, orgPosLookup, shiftLookup, roleLookup] = await Promise.all([
    prisma.personnel.findUnique({
      where: { id: session.id },
    }),
    prisma.personnel.findUnique({ where: { id: Number(id) } }),
    prisma.accessRole.findMany({
      orderBy: { name: "asc" },
    }),
    getCachedLookup("org_position"),
    getCachedLookup("shift"),
    getCachedLookup("role"),
  ]);

  if (!user) notFound();

  const hasManagePerm = await hasPerm(session, "user.manage");
  const isShiftSupervisor = currentUser?.orgPosition === 2;

  if (!hasManagePerm && !isShiftSupervisor) redirect("/users");

  // سرپرست شیفت فقط پرسنل شیفت خود که ادمین یا سرپرست نیستند را ویرایش می‌کند
  if (isShiftSupervisor && currentUser) {
    if (user.shift !== currentUser.shift || user.personnelType !== currentUser.personnelType) {
      redirect("/users");
    }
    if (user.orgPosition === 2 || user.orgPosition === 3) {
      redirect("/users");
    }
  }

  const serializableCurrentUser = currentUser ? {
    id: currentUser.id,
    shift: currentUser.shift,
    orgPosition: currentUser.orgPosition,
    personnelType: currentUser.personnelType,
    role: currentUser.role,
  } : null;

  return (
    <>
      <div className="topbar"><h1>ویرایش کاربر: {user.firstName} {user.lastName}</h1></div>
      <div className="content">
        <div className="card">
          <div className="card-body">
            <EditUserForm
              user={{
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                userName: user.userName,
                role: user.role,
                shift: user.shift,
                orgPosition: user.orgPosition,
                personnelType: user.personnelType,
                personnelCode: user.personnelCode || "",
                hasAccount: user.hasAccount,
                accessRoleId: user.accessRoleId,
                phone1: user.phone1 || "",
                phone2: user.phone2 || "",
                internalTel: user.internalTel || "",
                address: user.address || "",
                avatarColor: user.avatarColor || "",
              }}
              roles={roles}
              currentUser={serializableCurrentUser}
              orgPositions={orgPosLookup?.values || []}
              shifts={shiftLookup?.values || []}
              systemRoles={roleLookup?.values || []}
            />
          </div>
        </div>
      </div>
    </>
  );
}
