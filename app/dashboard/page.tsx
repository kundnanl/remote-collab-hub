// app/dashboard/page.tsx
import { auth } from "@clerk/nextjs/server";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { createCaller } from "@/server";
import DashboardHome from "@/components/dashboard/DashboardHome";

export default async function DashboardPage() {
  const { userId, orgId } = await auth();
  console.log("dashboard page", userId, orgId);

  if (!userId) redirect("/sign-in");

  if (!orgId) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
        <h1 className="text-2xl font-semibold mb-4">Select an Organization</h1>
        <p className="mb-6 text-gray-500 text-center">
          Choose or create an organization to continue to your dashboard.
        </p>
        <OrganizationSwitcher
          appearance={{
            elements: {
              rootBox: "w-full flex justify-center",
              organizationSwitcherTrigger:
                "border border-gray-300 px-4 py-2 rounded-md shadow-sm hover:shadow-md transition",
            },
          }}
          afterCreateOrganizationUrl="/dashboard"
          afterSelectOrganizationUrl="/dashboard"
        />
      </main>
    );
  }

  const caller = await createCaller();

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
  const inProgress = safeTasks.filter((t) => t.columnId !== null);

  return (
    <DashboardHome
      orgId={orgId}
      overdue={overdue.slice(0, 10)}
      dueToday={dueToday.slice(0, 10)}
      upcoming={upcoming.slice(0, 10)}
      inProgress={inProgress.slice(0, 10)}
    />
  );
}
