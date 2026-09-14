import { prisma } from "@/lib/prisma";
import { ORG_POSITIONS } from "@/lib/constants";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { redirect } from "next/navigation";
import { getCachedLookup } from "@/lib/lookups";
import NewUserForm from "./NewUserForm";

export default async function NewUserPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [currentUser, roles, orgPosLookup, shiftLookup] = await Promise.all([
    prisma.personnel.findUnique({
      where: { id: session.id },
    }),
    prisma.accessRole.findMany({
      orderBy: { name: "asc" },
    }),
    getCachedLookup("org_position"),
    getCachedLookup("shift"),
  ]);

  const hasManagePerm = await hasPerm(session, "user.create");
  const isShiftSupervisor = currentUser?.orgPosition === ORG_POSITIONS.RESPONSIBLE;

  if (!hasManagePerm && !isShiftSupervisor) redirect("/users");

  const serializableUser = currentUser ? {
    id: currentUser.id,
    shift: currentUser.shift,
    orgPosition: currentUser.orgPosition,
    personnelType: currentUser.personnelType,
    role: currentUser.role,
  } : null;

  return (
    <>
      <div className="topbar"><h1>افزودن کاربر جدید</h1></div>
      <div className="content">
        <div className="card">
          <div className="card-body">
            <NewUserForm
              roles={roles}
              currentUser={serializableUser}
              orgPositions={orgPosLookup?.values || []}
              shifts={shiftLookup?.values || []}
            />
          </div>
        </div>
      </div>
    </>
  );
}
