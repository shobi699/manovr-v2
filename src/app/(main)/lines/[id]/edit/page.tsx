import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { redirect, notFound } from "next/navigation";
import EditLineForm from "./EditLineForm";

export default async function EditLinePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !(await hasPerm(session, "line.edit"))) redirect("/lines");

  const { id } = await params;
  const [line, terminalType] = await Promise.all([
    prisma.line.findUnique({ where: { id: Number(id) } }),
    prisma.lookupType.findUnique({
      where: { key: "terminal" },
      include: {
        values: {
          orderBy: { sortIdx: "asc" },
        },
      },
    }),
  ]);

  if (!line) notFound();
  const terminals = terminalType?.values || [];

  return (
    <>
      <div className="topbar"><h1>ویرایش خط: {line.name}</h1></div>
      <div className="content">
        <div className="card">
          <div className="card-body">
            <EditLineForm
              line={{ id: line.id, name: line.name, tag: line.tag, capacity: line.capacity, terminal: line.terminal, isDynamic: line.isDynamic }}
              terminals={terminals}
            />
          </div>
        </div>
      </div>
    </>
  );
}
