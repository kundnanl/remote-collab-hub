import OfficeLayout from "@/components/dashboard/OfficeLayout";
import { auth } from "@clerk/nextjs/server";

export default async function OfficePage() {
  const { orgId } = await auth();

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center">
        <img src="/globe.svg" alt="No org" className="w-32 h-32 mb-6 opacity-80" />
        <h2 className="text-xl font-semibold mb-2">No organization found</h2>
        <p className="text-muted-foreground">
          You need to join or create an organization to use the Virtual Office.
        </p>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-8">🏢 Virtual Office</h1>
      <OfficeLayout officeId={orgId} />
    </main>
  );
}
