import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { createCaller } from "@/server";
import { DownloadPdfButton } from "@/components/reports/DownloadPdfButton";

export default async function ReportRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // 👈 Fix
  const { orgId } = await auth();
  if (!orgId) notFound();

  const caller = await createCaller();
  const run = await caller.reports.getRun({ orgId, runId: id });

  if (!run || run.status !== "READY") notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Report</div>
          <h1 className="text-2xl font-semibold">Sprint Summary</h1>
        </div>
        <DownloadPdfButton runId={id} />
      </div>

      <div className="rounded-xl border bg-background overflow-hidden">
        {/* eslint-disable-next-line react/no-danger */}
        <div dangerouslySetInnerHTML={{ __html: run.html ?? "<p>No HTML</p>" }} />
      </div>
    </div>
  );
}
