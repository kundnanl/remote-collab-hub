// dashboard/layout.tsx
import { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { onboardingComplete: true },
  });

  if (!user?.onboardingComplete) {
    redirect("/onboarding");
  }

  return (
    <main className="h-screen w-screen overflow-hidden">
      {children}
    </main>
  );
}
