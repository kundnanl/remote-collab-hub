// app/dashboard/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createCaller } from "@/server";
import ClientPresenceWrapper from "@/app/dashboard/office/presence-wrapper"; // you already have this
import DashboardHome from "@/components/dashboard/DashboardHome";

export default async function DashboardPage() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect("/");

  const caller = await createCaller();

  // Pull all tasks once; slice on the server so initial load is fast & deterministic.
  const tasks = await caller.tasks.list({ orgId, assigneeId: userId });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const soonCutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);

  const toIso = (d: Date | null) => (d ? d.toISOString() : null);
  const safeTasks = tasks.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    startDate: toIso(t.startDate),
    dueDate: toIso(t.dueDate),
  }));

  const overdue = safeTasks.filter((t) => t.dueDate && new Date(t.dueDate) < startOfToday);
  const dueToday = safeTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) >= startOfToday && new Date(t.dueDate) <= endOfToday
  );
  const upcoming = safeTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) > endOfToday && new Date(t.dueDate) <= soonCutoff
  );
  const inProgress = safeTasks.filter((t) => t.columnId !== null); // heuristic for “on the board”

  return (
    <ClientPresenceWrapper orgId={orgId}>
      <DashboardHome
        orgId={orgId}
        overdue={overdue.slice(0, 10)}
        dueToday={dueToday.slice(0, 10)}
        upcoming={upcoming.slice(0, 10)}
        inProgress={inProgress.slice(0, 10)}
      />
    </ClientPresenceWrapper>
  );
}
