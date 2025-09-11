import OfficeLayout from "@/components/dashboard/OfficeLayout";
import { auth, clerkClient } from "@clerk/nextjs/server";

export default async function OfficePage() {
  const { userId, orgId } = await auth(); // orgId comes from Clerk session

  if (!orgId) {
    return <p>No organization found.</p>;
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Virtual Office</h1>
      <OfficeLayout officeId={orgId} />
    </main>
  );
}
