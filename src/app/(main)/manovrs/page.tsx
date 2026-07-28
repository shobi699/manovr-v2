import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPerm } from "@/lib/perms";
import { getCachedLookup } from "@/lib/lookups";
import ManovrsTableClient from "./ManovrsTableClient";

export const dynamic = "force-dynamic";

export default async function ManovrsPage() {
  const session = await getSession();
  const canWrite = session ? await hasPerm(session, "manovr.create") : false;
  const canEdit = session ? await hasPerm(session, "manovr.edit") : false;
  const canConfirm = session ? await hasPerm(session, "manovr.confirm") : false;
  const canDelete = session ? await hasPerm(session, "manovr.delete") : false;

  const [manovrs, manovrTypeLookup, manovrStatusLookup, confirmationStatusLookup] = await Promise.all([
    prisma.manovr.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        sourceLine: true,
        destinationLine: true,
        train: true,
        rahbar1: true,
        creator: true,
      },
    }),
    getCachedLookup("manovr_type"),
    getCachedLookup("manovr_status"),
    getCachedLookup("confirmation_status"),
  ]);

  return (
    <>
      <PageHeader
        title="مدیریت و تاریخچه مانورها"
        breadcrumb={[{ label: "عملیات پایانه" }, { label: "تاریخچه مانورها" }]}
        actions={
          canWrite ? (
            <Link href="/manovrs/new" className="btn primary">
              ثبت مانور جدید
            </Link>
          ) : undefined
        }
      />
      <div className="content">
        <ManovrsTableClient
          manovrs={manovrs}
          canEdit={canEdit}
          canConfirm={canConfirm}
          canDelete={canDelete}
          manovrTypes={manovrTypeLookup?.values || []}
          manovrStatuses={manovrStatusLookup?.values || []}
          confirmationStatuses={confirmationStatusLookup?.values || []}
        />
      </div>
    </>
  );
}
